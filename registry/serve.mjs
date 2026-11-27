/** Serveur local du registre (http://localhost:3001). En ligne, Vercel sert registry/public. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".css": "text/css", ".js": "text/javascript" };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = path.join(root, url === "/" ? "index.html" : url);
  // rien en dehors de public/
  if (!file.startsWith(root + path.sep)) return res.writeHead(404).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "access-control-allow-origin": "*" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(Number(process.env.PORT ?? 3001), "127.0.0.1", () => console.log("registre : http://localhost:3001"));
