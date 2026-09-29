import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { clearQueue } from "../../spotify/endpoints/playback.js";
import { ok, toErrorResult } from "../errors.js";

export function registerClearQueueTool(server: McpServer): void {
  server.tool(
    "spotify_clear_queue",
    "Clear everything queued up after the currently playing track. Spotify has no native 'clear queue' " +
      "endpoint, so this works by restarting the current track/context at its current position, which drops " +
      "any manually-queued tracks after it. The currently playing (or paused) track itself is left as-is.",
    {},
    async () => {
      try {
        await clearQueue();
        return ok("Queue cleared. The current track keeps playing; everything queued after it was dropped.");
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
