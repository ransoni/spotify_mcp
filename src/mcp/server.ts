import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchTool } from "./tools/search.js";
import { registerNowPlayingTool } from "./tools/nowPlaying.js";
import { registerGetQueueTool } from "./tools/getQueue.js";
import { registerClearQueueTool } from "./tools/clearQueue.js";
import { registerListDevicesTool } from "./tools/devices.js";
import { registerPlayTool } from "./tools/play.js";
import { registerQueueAddTool } from "./tools/queueAdd.js";
import { registerPlaybackControlTool } from "./tools/playbackControl.js";
import { registerTransferPlaybackTool } from "./tools/transferPlayback.js";
import { registerCreatePlaylistTool } from "./tools/createPlaylist.js";
import { registerAddToPlaylistTool } from "./tools/addToPlaylist.js";
import { registerListPlaylistsTool } from "./tools/listPlaylists.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "spotify-mcp", version: "0.1.0" });

  registerSearchTool(server);
  registerNowPlayingTool(server);
  registerGetQueueTool(server);
  registerClearQueueTool(server);
  registerListDevicesTool(server);
  registerPlayTool(server);
  registerQueueAddTool(server);
  registerPlaybackControlTool(server);
  registerTransferPlaybackTool(server);
  registerCreatePlaylistTool(server);
  registerAddToPlaylistTool(server);
  registerListPlaylistsTool(server);

  return server;
}
