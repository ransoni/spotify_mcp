import { SpotifyAuthError } from "../auth/spotifyAuth.js";
import { SpotifyApiError, SpotifyPremiumRequiredError, SpotifyRateLimitError } from "../spotify/client.js";
import { NoActiveDeviceError, AmbiguousDeviceError, DeviceNotFoundError } from "../spotify/endpoints/devices.js";

export interface ToolTextResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function ok(text: string): ToolTextResult {
  return { content: [{ type: "text", text }] };
}

export function toErrorResult(err: unknown): ToolTextResult {
  let message: string;

  if (
    err instanceof SpotifyAuthError ||
    err instanceof NoActiveDeviceError ||
    err instanceof DeviceNotFoundError
  ) {
    message = err.message;
  } else if (err instanceof AmbiguousDeviceError) {
    message = `I found these Spotify devices: ${err.deviceNames.join(", ")}. Which one should I use?`;
  } else if (err instanceof SpotifyRateLimitError) {
    message = `Spotify is rate-limiting requests right now — try again in about ${err.retryAfterSeconds} seconds.`;
  } else if (err instanceof SpotifyPremiumRequiredError) {
    message = "This action requires Spotify Premium.";
  } else if (err instanceof SpotifyApiError) {
    message = `Spotify returned an error (${err.status}): ${err.message}`;
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = "An unknown error occurred.";
  }

  return { content: [{ type: "text", text: message }], isError: true };
}
