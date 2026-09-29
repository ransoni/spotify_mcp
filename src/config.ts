import { homedir } from "node:os";
import { join } from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set it before starting the server (see .env.example).`,
    );
  }
  return value;
}

export const SPOTIFY_CLIENT_ID = requireEnv("SPOTIFY_CLIENT_ID");

// Cloud Run (and any other HTTP deployment) sets PUBLIC_BASE_URL to the service's
// public HTTPS origin. Local stdio usage (Claude Desktop) leaves it unset and falls
// back to the loopback callback Spotify's dashboard is configured for by default.
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
export const CALLBACK_PORT = 8888;

export const IS_REMOTE_DEPLOYMENT = Boolean(PUBLIC_BASE_URL);

export const REDIRECT_URI = PUBLIC_BASE_URL
  ? `${PUBLIC_BASE_URL}/admin/spotify/callback`
  : `http://127.0.0.1:${CALLBACK_PORT}/callback`;

export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
];

export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";

// --- Local (stdio) token storage ---
export const CONFIG_DIR = join(homedir(), "Library", "Application Support", "spotify-mcp");
export const TOKENS_PATH = join(CONFIG_DIR, "tokens.json");

// --- Remote (Cloud Run) storage ---
// Unlike App Engine/Cloud Functions, Cloud Run does NOT auto-populate
// GOOGLE_CLOUD_PROJECT - it must be set explicitly via --set-env-vars on deploy
// (and for local testing against real GCP resources, e.g. `npm run dev:http`).
export const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID;
export const SPOTIFY_TOKENS_SECRET_NAME = process.env.SPOTIFY_TOKENS_SECRET_NAME ?? "spotify-mcp-tokens";
export const MCP_OWNER_PASSCODE_SECRET_NAME =
  process.env.MCP_OWNER_PASSCODE_SECRET_NAME ?? "mcp-owner-passcode";
