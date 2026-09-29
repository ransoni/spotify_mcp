import type { SpotifyTrack, SpotifyArtist, SpotifyAlbum, SpotifyPlaylist, SpotifyDevice } from "../../spotify/types.js";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatTrack(track: SpotifyTrack): string {
  const artists = track.artists.map((a) => a.name).join(", ");
  const year = track.album.release_date?.slice(0, 4) ?? "";
  return `"${track.name}" by ${artists} (${track.album.name}${year ? `, ${year}` : ""}) [${formatDuration(track.duration_ms)}] — uri: ${track.uri}`;
}

export function formatArtist(artist: SpotifyArtist): string {
  return `${artist.name} — uri: ${artist.uri}`;
}

export function formatAlbum(album: SpotifyAlbum): string {
  const year = album.release_date?.slice(0, 4) ?? "";
  return `"${album.name}"${year ? ` (${year})` : ""} — uri: ${album.uri}`;
}

export function formatPlaylist(playlist: SpotifyPlaylist): string {
  return `"${playlist.name}" (${playlist.tracks.total} tracks) — id: ${playlist.id}`;
}

export function formatDevice(device: SpotifyDevice): string {
  const active = device.is_active ? ", active" : "";
  const volume = device.volume_percent !== null ? `, volume ${device.volume_percent}%` : "";
  return `${device.name} (${device.type}${active}${volume})`;
}
