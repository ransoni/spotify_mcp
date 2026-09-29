import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { transferPlayback } from "../../spotify/endpoints/playback.js";
import { resolveTargetDeviceId } from "../../spotify/endpoints/devices.js";
import { ok, toErrorResult } from "../errors.js";

export function registerTransferPlaybackTool(server: McpServer): void {
  server.tool(
    "spotify_transfer_playback",
    "Move playback to a different Spotify Connect device (e.g. switch from phone to car), without " +
      "necessarily changing what's playing.",
    {
      device_name: z.string().describe("Name (or partial name) of the device to transfer playback to"),
      play: z.boolean().default(true).describe("Whether to keep playing on the new device (vs. stay paused)"),
    },
    async ({ device_name, play }) => {
      try {
        const deviceId = await resolveTargetDeviceId(device_name);
        if (!deviceId) {
          return toErrorResult(new Error(`Device "${device_name}" has no usable device id.`));
        }
        await transferPlayback(deviceId, play);
        return ok(`Playback transferred to ${device_name}.`);
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
