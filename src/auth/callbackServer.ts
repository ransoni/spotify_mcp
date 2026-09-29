import { createServer, type Server } from "node:http";
import { CALLBACK_PORT } from "../config.js";

export interface CallbackResult {
  code: string;
  state: string;
}

const SUCCESS_HTML = `<!doctype html>
<html><head><title>Spotify MCP</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 4rem;">
<h2>Authorization complete</h2>
<p>You can close this window and return to the terminal.</p>
</body></html>`;

const ERROR_HTML = (message: string) => `<!doctype html>
<html><head><title>Spotify MCP</title></head>
<body style="font-family: sans-serif; text-align: center; margin-top: 4rem;">
<h2>Authorization failed</h2>
<p>${message}</p>
</body></html>`;

export function waitForCallback(expectedState: string, timeoutMs = 120_000): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    let server: Server;
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for Spotify authorization callback."));
    }, timeoutMs);

    server = createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(ERROR_HTML(error));
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Spotify authorization error: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(ERROR_HTML("Invalid or mismatched state."));
        clearTimeout(timeout);
        server.close();
        reject(new Error("Invalid or missing code/state in Spotify callback."));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" }).end(SUCCESS_HTML);
      clearTimeout(timeout);
      server.close();
      resolve({ code, state });
    });

    server.listen(CALLBACK_PORT, "127.0.0.1");
  });
}
