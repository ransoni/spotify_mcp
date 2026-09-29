import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { search, type SearchType } from "../../spotify/endpoints/search.js";
import { ok, toErrorResult } from "../errors.js";
import { formatTrack, formatArtist, formatAlbum, formatPlaylist } from "./format.js";

export function registerSearchTool(server: McpServer): void {
  server.tool(
    "spotify_search",
    "Search Spotify for tracks, artists, albums, or playlists. Use this to resolve a spoken/typed name " +
      "(e.g. a song or artist mentioned by the user) into an exact Spotify URI before calling spotify_play, " +
      "spotify_queue_add, or spotify_add_to_playlist — those tools need exact URIs, not free text.",
    {
      query: z.string().describe("Search text, e.g. 'Bohemian Rhapsody Queen'"),
      types: z
        .array(z.enum(["track", "artist", "album", "playlist"]))
        .default(["track"])
        .describe("Which kinds of results to search for"),
      limit: z.number().min(1).max(20).default(5).describe("Max results per type"),
    },
    async ({ query, types, limit }) => {
      try {
        const results = await search(query, types as SearchType[], limit);
        const lines: string[] = [];

        if (results.tracks?.items.length) {
          lines.push("Tracks:", ...results.tracks.items.map((t) => `- ${formatTrack(t)}`));
        }
        if (results.artists?.items.length) {
          lines.push("Artists:", ...results.artists.items.map((a) => `- ${formatArtist(a)}`));
        }
        if (results.albums?.items.length) {
          lines.push("Albums:", ...results.albums.items.map((a) => `- ${formatAlbum(a)}`));
        }
        if (results.playlists?.items.length) {
          lines.push("Playlists:", ...results.playlists.items.map((p) => `- ${formatPlaylist(p)}`));
        }

        if (lines.length === 0) {
          return ok(`No results found for "${query}". Try a different phrasing.`);
        }

        return ok(lines.join("\n"));
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
