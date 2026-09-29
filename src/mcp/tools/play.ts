import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startResumePlayback } from "../../spotify/endpoints/playback.js";
import { resolveTargetDeviceId } from "../../spotify/endpoints/devices.js";
import { ok, toErrorResult } from "../errors.js";

export function registerPlayTool(server: McpServer): void {
  server.tool(
    "spotify_play",
    "Start playback of a specific track, album, artist, or playlist. Use spotify_search first to get the " +
      "exact URI(s) unless the caller already gave one. Provide exactly one of context_uri (for an album/" +
      "artist/playlist) or track_uris (for one or more specific tracks).",
    {
      context_uri: z.string().optional().describe("Spotify URI of an album, artist, or playlist to play"),
      track_uris: z.array(z.string()).max(50).optional().describe("One or more specific track URIs to play"),
      device_name: z.string().optional().describe("Name (or partial name) of the device to play on, e.g. 'car'"),
    },
    async ({ context_uri, track_uris, device_name }) => {
      if (!context_uri && (!track_uris || track_uris.length === 0)) {
        return toErrorResult(new Error("Provide either context_uri or track_uris to start playback."));
      }
      if (context_uri && track_uris && track_uris.length > 0) {
        return toErrorResult(new Error("Provide only one of context_uri or track_uris, not both."));
      }

      try {
        const deviceId = await resolveTargetDeviceId(device_name);
        await startResumePlayback({ deviceId, contextUri: context_uri, uris: track_uris });
        return ok("Playback started.");
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
