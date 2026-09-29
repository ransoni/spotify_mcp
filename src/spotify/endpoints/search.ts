import { spotifyJson } from "../client.js";
import type { SpotifySearchResults } from "../types.js";

export type SearchType = "track" | "artist" | "album" | "playlist";

export async function search(query: string, types: SearchType[], limit: number): Promise<SpotifySearchResults> {
  const params = new URLSearchParams({
    q: query,
    type: types.join(","),
    limit: String(limit),
  });
  return spotifyJson<SpotifySearchResults>(`/search?${params.toString()}`);
}
