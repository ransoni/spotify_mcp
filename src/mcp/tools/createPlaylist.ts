import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPlaylist, addItemsToPlaylist } from "../../spotify/endpoints/playlists.js";
import { getCurrentUser } from "../../spotify/endpoints/users.js";
import { ok, toErrorResult } from "../errors.js";

export function registerCreatePlaylistTool(server: McpServer): void {
  server.tool(
    "spotify_create_playlist",
    "Create a new Spotify playlist, optionally pre-filled with tracks. Use spotify_search first to resolve " +
      "track names to URIs. Returns the new playlist's id for follow-up spotify_add_to_playlist calls.",
    {
      name: z.string().describe("Playlist name"),
      description: z.string().optional(),
      public: z.boolean().default(false).describe("Whether the playlist should be public"),
      track_uris: z.array(z.string()).optional().describe("Track URIs to add to the playlist immediately"),
    },
    async ({ name, description, public: isPublic, track_uris }) => {
      try {
        const user = await getCurrentUser();
        const playlist = await createPlaylist(user.id, name, description, isPublic);
        if (track_uris && track_uris.length > 0) {
          await addItemsToPlaylist(playlist.id, track_uris);
        }
        return ok(
          `Created playlist "${playlist.name}" (id: ${playlist.id})${track_uris?.length ? ` with ${track_uris.length} track(s)` : ""}.`,
        );
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
