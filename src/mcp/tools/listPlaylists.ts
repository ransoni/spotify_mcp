import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUserPlaylists } from "../../spotify/endpoints/playlists.js";
import { ok, toErrorResult } from "../errors.js";
import { formatPlaylist } from "./format.js";

export function registerListPlaylistsTool(server: McpServer): void {
  server.tool(
    "spotify_list_playlists",
    "List the user's own Spotify playlists. Use this to find a playlist_id by name for spotify_add_to_playlist.",
    {
      limit: z.number().min(1).max(50).default(20),
    },
    async ({ limit }) => {
      try {
        const playlists = await getUserPlaylists(limit);
        if (playlists.length === 0) {
          return ok("No playlists found.");
        }
        return ok(playlists.map((p) => `- ${formatPlaylist(p)}`).join("\n"));
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
