# spotify-mcp

Local MCP server for controlling Spotify from Claude Desktop by dictated prompts — search, queue, play, and manage playlists.

## Setup

1. **Register a Spotify app**: https://developer.spotify.com/dashboard → Create app.
   - Redirect URI: `http://127.0.0.1:8888/callback` (must be exactly this — Spotify requires the literal `127.0.0.1`, not `localhost`).
   - Note the **Client ID** shown on the app's settings page (no secret needed).

2. **Install and build**:
   ```bash
   npm install
   npm run build
   ```

3. **Authorize** (one-time, opens your browser to log into Spotify):
   ```bash
   SPOTIFY_CLIENT_ID=<your-client-id> npm run authorize
   ```
   Tokens are stored at `~/Library/Application Support/spotify-mcp/tokens.json`. Re-run this command any time Spotify access expires or is revoked.

4. **Register with Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "spotify": {
         "command": "node",
         "args": ["/absolute/path/to/spotify_mcp/dist/index.js"],
         "env": { "SPOTIFY_CLIENT_ID": "<your-client-id>" }
       }
     }
   }
   ```
   Restart Claude Desktop.

## Usage

For playback and queue commands, Spotify needs an **active device** — open Spotify on your phone (or connect it to your car via Spotify Connect) before asking Claude to play or queue something.

Example prompts:
- "What's playing on Spotify right now?"
- "Search Spotify for Bohemian Rhapsody by Queen and add it to the queue"
- "Play the album Innervisions by Stevie Wonder"
- "Pause" / "Skip to the next song"
- "Create a playlist called Road Trip with [songs]"

## Development

```bash
npm run dev        # stdio server, for manual testing with Claude Desktop
npm run dev:http    # HTTP server (Cloud Run mode), for local testing
```

## Deploy to Cloud Run (remote access from Claude.ai / mobile)

Running the server on Cloud Run exposes it as a remote MCP connector, so Spotify can
be controlled from Claude.ai or the mobile app, not just a desktop with the stdio
process running. This adds a second OAuth layer on top of the existing Spotify PKCE
flow: Claude.ai dynamically registers itself as an OAuth client against this server,
and a short owner passcode gates the consent step so only you can complete that flow.

**One-time GCP setup** (replace `<region>`, e.g. `europe-north1`):

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

gcloud firestore databases create --location=<region>   # skip if a database already exists

gcloud secrets create spotify-mcp-tokens
gcloud secrets create mcp-owner-passcode
printf '%s' "$(openssl rand -base64 24)" | gcloud secrets versions add mcp-owner-passcode --data-file=-

gcloud artifacts repositories create spotify-mcp --repository-format=docker --location=<region>

gcloud iam service-accounts create spotify-mcp-run-sa
PROJECT=$(gcloud config get-value project)
SA="spotify-mcp-run-sa@${PROJECT}.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding spotify-mcp-tokens --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding spotify-mcp-tokens --member="serviceAccount:${SA}" --role=roles/secretmanager.secretVersionAdder
gcloud secrets add-iam-policy-binding mcp-owner-passcode --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${SA}" --role=roles/datastore.user
```

Add a redirect URI in the [Spotify dashboard](https://developer.spotify.com/dashboard)
alongside the existing local one: `https://<cloud-run-url>/admin/spotify/callback`
(you won't know `<cloud-run-url>` until after the first deploy — deploy once, then
update this).

**Build & deploy:**

```bash
gcloud builds submit --tag <region>-docker.pkg.dev/$PROJECT/spotify-mcp/server

gcloud run deploy spotify-mcp \
  --image=<region>-docker.pkg.dev/$PROJECT/spotify-mcp/server \
  --region=<region> \
  --service-account="$SA" \
  --allow-unauthenticated \
  --min-instances=0 --max-instances=1 \
  --set-env-vars=SPOTIFY_CLIENT_ID=<your-client-id>,PUBLIC_BASE_URL=https://<cloud-run-url>,GOOGLE_CLOUD_PROJECT=$PROJECT
```

The app talks to Secret Manager and Firestore directly through its service account's
credentials (Application Default Credentials) — no secret values need to be mounted
via `--set-secrets`; only the secret *names* matter, and the defaults
(`spotify-mcp-tokens`, `mcp-owner-passcode`) already match what was created above.

`GOOGLE_CLOUD_PROJECT` must be set explicitly — unlike App Engine/Cloud Functions,
Cloud Run does not inject it automatically, and without it the app can't tell it
should use Secret Manager/Firestore instead of local-file storage.

`--allow-unauthenticated` is required — Claude.ai's OAuth flow and the `/mcp` calls
that follow come from Anthropic's infrastructure, not an identity Cloud Run IAM can
authorize. The owner-passcode-gated consent step is what actually protects the
service. `--max-instances=1` keeps the in-process bootstrap state used during Spotify
linking simple; everything else (OAuth clients/tokens, Spotify tokens) is stored in
Firestore/Secret Manager, not in memory.

`PUBLIC_BASE_URL` isn't known until the first deploy assigns the `*.run.app` URL —
deploy once with a placeholder, then redeploy with the real URL (or map a custom
domain up front and use that from the start).

**One-time post-deploy setup:**

1. Visit `https://<cloud-run-url>/admin/authorize-spotify`, enter the owner passcode
   (the value you generated into `mcp-owner-passcode` above), and complete the Spotify
   login. Tokens are saved to the `spotify-mcp-tokens` secret.
2. In Claude.ai (or the mobile app): **Settings → Connectors → Add custom connector**,
   URL `https://<cloud-run-url>/mcp`. Claude discovers the OAuth metadata, registers
   itself, and redirects you through a consent page — enter the same owner passcode
   once to link Claude to your Spotify account.

Local stdio usage (`npm run dev` / the Claude Desktop config above) is unaffected by
any of this — it keeps using the file-based token store and the loopback redirect.
