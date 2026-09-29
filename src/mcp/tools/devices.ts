import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDevices } from "../../spotify/endpoints/devices.js";
import { ok, toErrorResult } from "../errors.js";
import { formatDevice } from "./format.js";

export function registerListDevicesTool(server: McpServer): void {
  server.tool(
    "spotify_list_devices",
    "List Spotify Connect devices currently available (phones, computers, speakers, cars). " +
      "Useful to check which device is active before playing something, or to find a device name " +
      "to pass to other tools.",
    {},
    async () => {
      try {
        const devices = await getDevices();
        if (devices.length === 0) {
          return ok("No Spotify devices found. Open Spotify on your phone or connect to a device, then try again.");
        }
        return ok(devices.map((d) => `- ${formatDevice(d)}`).join("\n"));
      } catch (err) {
        return toErrorResult(err);
      }
    },
  );
}
