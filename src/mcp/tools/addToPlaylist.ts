import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addItemsToPlaylist } from "../../spotify/endpoints/playlists.js";
import { ok, toErrorResult } from "../errors.js";

export function registerAddToPlaylistTool(server: McpServer): void {
  server.tool(
    "spotify_add_to_playlist",
    "Add one or more tracks to an existing playlist. Use spotify_list_playlists to find the playlist_id " +
      "by name, and spotify_search to resolve track names to URIs.",
    {
      playlist_id: z.string().describe("Id of the playlist to add tracks to"),
      track_uris: z.array(z.string()).min(1).describe("Track URIs to add"),
    },
    async ({ playlist_id, track_uris }) => {
      try {
        await addItemsToPlaylist(playlist_id, track_uris);
        return ok(`Added ${track_uris.length} track(s) to the playlist.`);
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
