import type { Response } from "express";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import * as store from "./oauthStore.js";
import { escapeHtml } from "./html.js";

// This server exposes a single capability (Spotify control), so every issued
// token carries the same fixed scope regardless of what the client requests.
export const MCP_SCOPES = ["spotify-control"];

const clientsStore: OAuthRegisteredClientsStore = {
  getClient: store.getClient,
  registerClient(client) {
    // The SDK's dynamic-client-registration handler always sets client_id and
    // client_id_issued_at before calling this, even though the declared parameter
    // type (Omit<..., 'client_id' | 'client_id_issued_at'>) suggests otherwise.
    return store.registerClient(client as OAuthClientInformationFull);
  },
};

export function renderConsentPage(params: {
  clientId: string;
  clientName?: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  scope: string;
  resource?: string;
  error?: string;
}): string {
  const displayName = escapeHtml(params.clientName ?? params.clientId);
  let redirectHost = params.redirectUri;
  try {
    redirectHost = new URL(params.redirectUri).host;
  } catch {
    // fall back to showing the raw value if it somehow isn't a valid URL
  }
  return `<!doctype html>
<html><head><title>Spotify MCP</title></head>
<body style="font-family: sans-serif; max-width: 28rem; margin: 4rem auto; text-align: center;">
  <h2>Connect to Spotify MCP</h2>
  <p><strong>${displayName}</strong> wants to control your Spotify account through this server.</p>
  <p style="color: #666; font-size: 0.9rem;">You'll be redirected back to <strong>${escapeHtml(redirectHost)}</strong>. Only continue if you recognize this as the app you're connecting (e.g. Claude).</p>
  ${params.error ? `<p style="color: #c00;">${escapeHtml(params.error)}</p>` : ""}
  <form method="POST" action="/consent">
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
    <input type="hidden" name="state" value="${escapeHtml(params.state ?? "")}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
    <input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />
    <input type="hidden" name="resource" value="${escapeHtml(params.resource ?? "")}" />
    <input type="password" name="passcode" placeholder="Owner passcode" autofocus
      style="padding: 0.5rem; font-size: 1rem; width: 100%; box-sizing: border-box; margin: 1rem 0;" />
    <button type="submit" style="padding: 0.5rem 1.5rem; font-size: 1rem;">Authorize</button>
  </form>
</body></html>`;
}

export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    res
      .status(200)
      .type("html")
      .send(
        renderConsentPage({
          clientId: client.client_id,
          clientName: client.client_name,
          redirectUri: params.redirectUri,
          state: params.state,
          codeChallenge: params.codeChallenge,
          scope: MCP_SCOPES.join(" "),
          resource: params.resource?.href,
        }),
      );
  },

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = await store.getAuthorizationCode(authorizationCode);
    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    return record.codeChallenge;
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const record = await store.consumeAuthorizationCode(authorizationCode);
    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    if (redirectUri && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }

    const tokens = await store.issueTokens({
      clientId: client.client_id,
      scopes: record.scopes,
      resource: resource?.href ?? record.resource,
    });

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "bearer",
      expires_in: tokens.expiresIn,
      scope: record.scopes.join(" "),
    };
  },

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const record = await store.consumeRefreshToken(refreshToken);
    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid or expired refresh token");
    }

    const grantedScopes = scopes ?? record.scopes;
    const tokens = await store.issueTokens({
      clientId: client.client_id,
      scopes: grantedScopes,
      resource: resource?.href ?? record.resource,
    });

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "bearer",
      expires_in: tokens.expiresIn,
      scope: grantedScopes.join(" "),
    };
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await store.verifyAccessToken(token);
    if (!record) {
      throw new InvalidTokenError("Invalid or expired access token");
    }
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt / 1000),
      resource: record.resource ? new URL(record.resource) : undefined,
    };
  },

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    await store.revokeToken(request.token);
  },
};
