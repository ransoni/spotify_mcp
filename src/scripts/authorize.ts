import open from "open";
import { SPOTIFY_ACCOUNTS_BASE, SPOTIFY_CLIENT_ID, REDIRECT_URI, SCOPES } from "../config.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../auth/pkce.js";
import { waitForCallback } from "../auth/callbackServer.js";
import { exchangeCodeForTokens } from "../auth/spotifyAuth.js";

async function main() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const authorizeUrl = new URL(`${SPOTIFY_ACCOUNTS_BASE}/authorize`);
  authorizeUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", SCOPES.join(" "));

  console.log("Opening browser for Spotify authorization...");
  console.log(`If it doesn't open automatically, visit:\n${authorizeUrl.toString()}\n`);

  const callbackPromise = waitForCallback(state);
  await open(authorizeUrl.toString());

  const { code } = await callbackPromise;
  console.log("Received authorization code, exchanging for tokens...");

  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  console.log(`Success. Granted scopes: ${tokens.scope}`);
  console.log("You can now use the Spotify MCP server from Claude Desktop.");
}

main().catch((err) => {
  console.error("Authorization failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
