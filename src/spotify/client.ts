import { SPOTIFY_API_BASE } from "../config.js";
import { getValidAccessToken, forceRefresh } from "../auth/spotifyAuth.js";

export class SpotifyApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export class SpotifyRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s.`);
    this.name = "SpotifyRateLimitError";
  }
}

export class SpotifyPremiumRequiredError extends Error {
  constructor() {
    super("This action requires Spotify Premium.");
    this.name = "SpotifyPremiumRequiredError";
  }
}

interface SpotifyErrorBody {
  error?: { status?: number; message?: string; reason?: string };
}

async function parseErrorBody(res: Response): Promise<SpotifyErrorBody | undefined> {
  try {
    return (await res.json()) as SpotifyErrorBody;
  } catch {
    return undefined;
  }
}

/**
 * Authenticated fetch wrapper for the Spotify Web API.
 * Handles token refresh, one 401 retry, and 429 backoff.
 */
export async function spotifyFetch(path: string, init: RequestInit = {}, _retried = false): Promise<Response> {
  const accessToken = await getValidAccessToken();
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (res.status === 401 && !_retried) {
    await forceRefresh();
    return spotifyFetch(path, init, true);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    if (retryAfter <= 2 && !_retried) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return spotifyFetch(path, init, true);
    }
    throw new SpotifyRateLimitError(retryAfter);
  }

  if (res.status === 403) {
    const body = await parseErrorBody(res);
    if (body?.error?.reason === "PREMIUM_REQUIRED") {
      throw new SpotifyPremiumRequiredError();
    }
    throw new SpotifyApiError(403, body?.error?.message ?? "Forbidden", body);
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new SpotifyApiError(res.status, body?.error?.message ?? res.statusText, body);
  }

  return res;
}

export async function spotifyJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await spotifyFetch(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
