// Minimal zero-dependency preview. Serves only published app files, never .git or secrets.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd();
const allowed = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/src/app.mjs", ["src/app.mjs", "text/javascript; charset=utf-8"]],
  ["/src/core.mjs", ["src/core.mjs", "text/javascript; charset=utf-8"]]
]);
createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (!["GET", "HEAD"].includes(req.method || "") || !allowed.has(pathname)) {
    res.writeHead(403, { "content-type": "text/plain" }); return res.end("Forbidden");
  }
  try {
    const [file, type] = allowed.get(pathname);
    const content = await readFile(resolve(root, file));
    res.writeHead(200, { "content-type": type,
      "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch { res.writeHead(404); res.end("Not found"); }
}).listen(Number(process.env.PORT || 4173), "127.0.0.1", () => console.log("Preview http://127.0.0.1:" + (process.env.PORT || 4173)));
