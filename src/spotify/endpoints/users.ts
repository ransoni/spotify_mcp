import { spotifyJson } from "../client.js";
import type { SpotifyUser } from "../types.js";

export async function getCurrentUser(): Promise<SpotifyUser> {
  return spotifyJson<SpotifyUser>("/me");
}
