import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pausePlayback, startResumePlayback, skip } from "../../spotify/endpoints/playback.js";
import { resolveTargetDeviceId } from "../../spotify/endpoints/devices.js";
import { ok, toErrorResult } from "../errors.js";

export function registerPlaybackControlTool(server: McpServer): void {
  server.tool(
    "spotify_playback_control",
    "Pause, resume, or skip to the next/previous track in current playback.",
    {
      action: z.enum(["pause", "resume", "next", "previous"]),
      device_name: z.string().optional().describe("Name (or partial name) of the device to control"),
    },
    async ({ action, device_name }) => {
      try {
        const deviceId = await resolveTargetDeviceId(device_name);
        switch (action) {
          case "pause":
            await pausePlayback(deviceId);
            break;
          case "resume":
            await startResumePlayback({ deviceId });
            break;
          case "next":
            await skip("next", deviceId);
            break;
          case "previous":
            await skip("previous", deviceId);
            break;
        }
        return ok(`Playback ${action} done.`);
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
