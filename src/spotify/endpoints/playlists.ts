import { spotifyJson } from "../client.js";
import type { SpotifyPlaylist } from "../types.js";

export async function createPlaylist(
  userId: string,
  name: string,
  description: string | undefined,
  isPublic: boolean,
): Promise<SpotifyPlaylist> {
  return spotifyJson<SpotifyPlaylist>(`/users/${encodeURIComponent(userId)}/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, description, public: isPublic }),
  });
}

const MAX_URIS_PER_REQUEST = 100;

export async function addItemsToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += MAX_URIS_PER_REQUEST) {
    const chunk = uris.slice(i, i + MAX_URIS_PER_REQUEST);
    await spotifyJson(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

export async function getUserPlaylists(limit: number): Promise<SpotifyPlaylist[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const data = await spotifyJson<{ items: SpotifyPlaylist[] }>(`/me/playlists?${params.toString()}`);
  return data.items;
}
