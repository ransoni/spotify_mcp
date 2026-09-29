import express, { type Express } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PUBLIC_BASE_URL } from "../config.js";
import { createServer } from "../mcp/server.js";
import { oauthProvider, renderConsentPage, MCP_SCOPES } from "./oauthProvider.js";
import * as oauthStore from "./oauthStore.js";
import { verifyOwnerPasscode } from "./passcode.js";
import { adminRouter } from "./adminRoutes.js";

export function createHttpApp(): Express {
  if (!PUBLIC_BASE_URL) {
    throw new Error("PUBLIC_BASE_URL must be set to run the HTTP server (see .env.example).");
  }
  const issuerUrl = new URL(PUBLIC_BASE_URL);
  const mcpUrl = new URL("/mcp", PUBLIC_BASE_URL);

  const app = createMcpExpressApp({ host: "0.0.0.0", allowedHosts: [issuerUrl.hostname] });
  app.use(express.urlencoded({ extended: false }));

  // Not "/healthz" - that exact path is intercepted by Google's front-end
  // infrastructure on *.run.app domains and never reaches the container.
  app.get("/health", (_req, res) => {
    res.status(200).send("ok");
  });

  app.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl,
      resourceServerUrl: mcpUrl,
      resourceName: "Spotify MCP",
      scopesSupported: MCP_SCOPES,
    }),
  );

  // The consent step for /authorize (owner-passcode gate). Kept outside the SDK's
  // authorize handler so a wrong passcode just re-renders the form instead of
  // aborting the OAuth flow with a redirect-based error.
  app.post("/consent", async (req, res) => {
    const body = req.body as Record<string, string | undefined>;
    const clientId = body.client_id;
    const redirectUri = body.redirect_uri;
    const codeChallenge = body.code_challenge;
    const state = body.state;
    const resource = body.resource || undefined;

    if (!clientId || !redirectUri || !codeChallenge) {
      res.status(400).send("Malformed consent request.");
      return;
    }

    if (!body.passcode || !(await verifyOwnerPasscode(body.passcode))) {
      res
        .status(401)
        .type("html")
        .send(
          renderConsentPage({
            clientId,
            redirectUri,
            state,
            codeChallenge,
            scope: MCP_SCOPES.join(" "),
            resource,
            error: "Incorrect passcode. Try again.",
          }),
        );
      return;
    }

    const code = await oauthStore.createAuthorizationCode({
      clientId,
      redirectUri,
      codeChallenge,
      scopes: MCP_SCOPES,
      resource,
    });

    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (state) redirect.searchParams.set("state", state);
    res.redirect(302, redirect.toString());
  });

  app.use(
    "/mcp",
    requireBearerAuth({
      verifier: oauthProvider,
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
    }),
  );

  // Stateless Streamable HTTP: a fresh MCP server + transport per request, so nothing
  // needs to stay pinned to a particular Cloud Run instance between calls.
  app.post("/mcp", async (req, res) => {
    const server = createServer();
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (err) {
      console.error("Error handling MCP request:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  app.use("/admin", adminRouter);

  return app;
}
