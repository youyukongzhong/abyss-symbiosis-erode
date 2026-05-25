import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { cwd } from "node:process";

const root = cwd();
const port = Number(process.env.PORT || 4173);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const rawPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const urlPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = normalize(join(root, urlPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": types[extname(filePath)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}`);
});
