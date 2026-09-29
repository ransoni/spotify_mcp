import { SPOTIFY_ACCOUNTS_BASE, SPOTIFY_CLIENT_ID, REDIRECT_URI } from "../config.js";
import { readTokens, writeTokens, type TokenData } from "./tokenStore.js";

export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

const REFRESH_MARGIN_MS = 60_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new SpotifyAuthError(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as TokenResponse;
  const tokens: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? "",
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    token_type: data.token_type,
  };
  await writeTokens(tokens);
  return tokens;
}

async function refreshTokens(current: TokenData): Promise<TokenData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
    client_id: SPOTIFY_CLIENT_ID,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    if (res.status === 400) {
      throw new SpotifyAuthError(
        "Spotify authorization has expired or was revoked. Run `npm run authorize` in the project directory, then try again.",
      );
    }
    throw new SpotifyAuthError(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as TokenResponse;
  const updated: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? current.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    token_type: data.token_type,
  };
  await writeTokens(updated);
  return updated;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new SpotifyAuthError(
      "No Spotify authorization found. Run `npm run authorize` in the project directory, then try again.",
    );
  }

  if (tokens.expires_at - Date.now() < REFRESH_MARGIN_MS) {
    const refreshed = await refreshTokens(tokens);
    return refreshed.access_token;
  }

  return tokens.access_token;
}

export async function forceRefresh(): Promise<string> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new SpotifyAuthError(
      "No Spotify authorization found. Run `npm run authorize` in the project directory, then try again.",
    );
  }
  const refreshed = await refreshTokens(tokens);
  return refreshed.access_token;
}
