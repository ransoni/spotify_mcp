import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getQueue } from "../../spotify/endpoints/playback.js";
import { ok, toErrorResult } from "../errors.js";
import { formatTrack } from "./format.js";

export function registerGetQueueTool(server: McpServer): void {
  server.tool(
    "spotify_get_queue",
    "Get the current 'play next' queue: the currently playing track plus the tracks queued up after it.",
    {
      limit: z.number().min(1).max(50).default(10).describe("Max upcoming tracks to return"),
    },
    async ({ limit }) => {
      try {
        const { currentlyPlaying, queue } = await getQueue();
        const lines: string[] = [];

        lines.push(currentlyPlaying ? `Now playing: ${formatTrack(currentlyPlaying)}` : "Nothing is currently playing.");

        if (queue.length === 0) {
          lines.push("Queue is empty.");
        } else {
          lines.push("Up next:", ...queue.slice(0, limit).map((t, i) => `${i + 1}. ${formatTrack(t)}`));
        }

        return ok(lines.join("\n"));
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
