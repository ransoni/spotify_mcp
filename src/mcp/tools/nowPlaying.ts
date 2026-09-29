import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPlaybackState } from "../../spotify/endpoints/playback.js";
import { ok, toErrorResult } from "../errors.js";
import { formatTrack, formatDuration } from "./format.js";

export function registerNowPlayingTool(server: McpServer): void {
  server.tool(
    "spotify_get_now_playing",
    "Get what's currently playing on Spotify, including progress and which device it's playing on.",
    {},
    async () => {
      try {
        const state = await getPlaybackState();
        if (!state || !state.item) {
          return ok("Nothing is currently playing on Spotify.");
        }
        const progress = state.progress_ms !== null ? formatDuration(state.progress_ms) : "0:00";
        const status = state.is_playing ? "Playing" : "Paused";
        const device = state.device ? ` on ${state.device.name}` : "";
        return ok(`${status}${device}: ${formatTrack(state.item)} — ${progress} / ${formatDuration(state.item.duration_ms)}`);
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
