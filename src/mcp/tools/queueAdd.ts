import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addTracksToQueue } from "../../spotify/endpoints/playback.js";
import { resolveTargetDeviceId } from "../../spotify/endpoints/devices.js";
import { ok, toErrorResult } from "../errors.js";

export function registerQueueAddTool(server: McpServer): void {
  server.tool(
    "spotify_queue_add",
    "Add one or more tracks to the play queue (play next/later) without interrupting current playback. " +
      "Use spotify_search first to get exact track URIs.",
    {
      track_uris: z.array(z.string()).min(1).max(25).describe("Track URIs to add to the queue, in order"),
      device_name: z.string().optional().describe("Name (or partial name) of the device whose queue to add to"),
    },
    async ({ track_uris, device_name }) => {
      try {
        const deviceId = await resolveTargetDeviceId(device_name);
        await addTracksToQueue(track_uris, deviceId);
        return ok(`Added ${track_uris.length} track(s) to the queue.`);
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
