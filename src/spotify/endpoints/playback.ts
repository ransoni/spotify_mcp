import { spotifyFetch, spotifyJson } from "../client.js";
import type { SpotifyPlaybackState, SpotifyTrack } from "../types.js";

export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  const res = await spotifyFetch("/me/player");
  if (res.status === 204) return null;
  return (await res.json()) as SpotifyPlaybackState;
}

export interface QueueState {
  currentlyPlaying: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

export async function getQueue(): Promise<QueueState> {
  const data = await spotifyJson<{ currently_playing: SpotifyTrack | null; queue: SpotifyTrack[] }>(
    "/me/player/queue",
  );
  return { currentlyPlaying: data.currently_playing, queue: data.queue };
}

export interface StartPlaybackOptions {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
}

export async function startResumePlayback(opts: StartPlaybackOptions): Promise<void> {
  const query = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : "";
  const body: Record<string, unknown> = {};
  if (opts.contextUri) body.context_uri = opts.contextUri;
  if (opts.uris) body.uris = opts.uris;

  await spotifyFetch(`/me/player/play${query}`, {
    method: "PUT",
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
}

export async function pausePlayback(deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/pause${query}`, { method: "PUT" });
}

export async function skip(direction: "next" | "previous", deviceId?: string): Promise<void> {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/${direction}${query}`, { method: "POST" });
}

export async function addToQueue(uri: string, deviceId?: string): Promise<void> {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/queue?${params.toString()}`, { method: "POST" });
}

export async function addTracksToQueue(uris: string[], deviceId?: string): Promise<void> {
  for (const uri of uris) {
    await addToQueue(uri, deviceId);
  }
}

export async function transferPlayback(deviceId: string, play: boolean): Promise<void> {
  await spotifyFetch("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}
