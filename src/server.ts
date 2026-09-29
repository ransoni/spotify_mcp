import { createHttpApp } from "./server/httpApp.js";

const port = Number(process.env.PORT ?? 8080);

const app = createHttpApp();
app.listen(port, () => {
  console.log(`spotify-mcp HTTP server listening on port ${port}`);
});
