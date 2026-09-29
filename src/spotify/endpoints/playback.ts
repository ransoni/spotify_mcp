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
  offset?: { uri: string } | { position: number };
  positionMs?: number;
}

export async function startResumePlayback(opts: StartPlaybackOptions): Promise<void> {
  const query = opts.deviceId ? `?device_id=${encodeURIComponent(opts.deviceId)}` : "";
  const body: Record<string, unknown> = {};
  if (opts.contextUri) body.context_uri = opts.contextUri;
  if (opts.uris) body.uris = opts.uris;
  if (opts.offset) body.offset = opts.offset;
  if (opts.positionMs !== undefined) body.position_ms = opts.positionMs;

  await spotifyFetch(`/me/player/play${query}`, {
    method: "PUT",
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
}

/**
 * Spotify's Web API has no endpoint to clear the manually-added queue directly.
 * The workaround (same one Spotify's own clients effectively do) is to
 * restart playback of the current context/track at its current position,
 * which drops everything queued after it while leaving the current track
 * (and its play/pause state) where it was.
 */
export async function clearQueue(): Promise<void> {
  const state = await getPlaybackState();
  if (!state || !state.item) {
    throw new Error("Nothing is currently playing, so there's no queue to clear.");
  }

  const deviceId = state.device?.id ?? undefined;
  const positionMs = state.progress_ms ?? 0;

  if (state.context?.uri) {
    await startResumePlayback({
      deviceId,
      contextUri: state.context.uri,
      offset: { uri: state.item.uri },
      positionMs,
    });
  } else {
    await startResumePlayback({
      deviceId,
      uris: [state.item.uri],
      positionMs,
    });
  }

  if (!state.is_playing) {
    await pausePlayback(deviceId);
  }
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
