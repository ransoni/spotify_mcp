import { Router } from "express";
import { SPOTIFY_ACCOUNTS_BASE, SPOTIFY_CLIENT_ID, REDIRECT_URI, SCOPES } from "../config.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../auth/pkce.js";
import { exchangeCodeForTokens } from "../auth/spotifyAuth.js";
import { verifyOwnerPasscode } from "./passcode.js";
import { escapeHtml } from "./html.js";

const PENDING_TTL_MS = 10 * 60 * 1000;

// Single-instance, short-lived bootstrap state (Cloud Run is pinned to one instance —
// see the deploy plan). Only used once per Spotify re-link, not on the request hot path.
const pending = new Map<string, { codeVerifier: string; createdAt: number }>();

function prunePending(): void {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [state, entry] of pending) {
    if (entry.createdAt < cutoff) pending.delete(state);
  }
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html><head><title>${escapeHtml(title)}</title></head>
<body style="font-family: sans-serif; max-width: 24rem; margin: 4rem auto; text-align: center;">
${body}
</body></html>`;
}

function passcodeFormHtml(error?: string): string {
  return page(
    "Spotify MCP",
    `<h2>Link Spotify account</h2>
${error ? `<p style="color:#c00;">${escapeHtml(error)}</p>` : ""}
<form method="GET" action="/admin/authorize-spotify">
  <input type="password" name="passcode" placeholder="Owner passcode" autofocus
    style="padding: 0.5rem; font-size: 1rem; width: 100%; box-sizing: border-box; margin: 1rem 0;" />
  <button type="submit" style="padding: 0.5rem 1.5rem; font-size: 1rem;">Continue</button>
</form>`,
  );
}

export const adminRouter = Router();

adminRouter.get("/authorize-spotify", async (req, res) => {
  const passcode = typeof req.query.passcode === "string" ? req.query.passcode : "";
  if (!passcode || !(await verifyOwnerPasscode(passcode))) {
    res
      .status(passcode ? 401 : 200)
      .type("html")
      .send(passcodeFormHtml(passcode ? "Incorrect passcode." : undefined));
    return;
  }

  prunePending();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  pending.set(state, { codeVerifier, createdAt: Date.now() });

  const authorizeUrl = new URL(`${SPOTIFY_ACCOUNTS_BASE}/authorize`);
  authorizeUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", SCOPES.join(" "));

  res.redirect(302, authorizeUrl.toString());
});

adminRouter.get("/spotify/callback", async (req, res) => {
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  if (error || !code || !state) {
    res
      .status(400)
      .type("html")
      .send(page("Spotify MCP", `<h2>Authorization failed</h2><p>${escapeHtml(error ?? "Missing code or state.")}</p>`));
    return;
  }

  const entry = pending.get(state);
  pending.delete(state);
  if (!entry) {
    res
      .status(400)
      .type("html")
      .send(
        page(
          "Spotify MCP",
          `<h2>Link expired</h2><p>Start over at <a href="/admin/authorize-spotify">/admin/authorize-spotify</a>.</p>`,
        ),
      );
    return;
  }

  await exchangeCodeForTokens(code, entry.codeVerifier);
  res
    .status(200)
    .type("html")
    .send(page("Spotify MCP", "<h2>Spotify linked</h2><p>You can now add the Spotify MCP connector in Claude.</p>"));
});
