import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { handleSourceRequest } from "./handler.js";
import { applySecurityHeaders } from "./lib/securityHeaders.js";
import { createRateLimiter, shouldRateLimitSourceRequest } from "./lib/rateLimit.js";
import { sendSourceResponse } from "./lib/response.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT) || 4173;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  const safePath = decodeURIComponent(urlPath.split("?")[0]);
  const relative = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.normalize(path.join(root, relative));
  if (!filePath.startsWith(root)) return null;
  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
  createReadStream(filePath).pipe(res);
}

const checkRateLimit = createRateLimiter();

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res, { production: true });

  if (shouldRateLimitSourceRequest(req.url ?? "")) {
    if (checkRateLimit(req, res)) return;
  }

  const sourceResult = await handleSourceRequest(req.url ?? "");
  if (sourceResult) {
    return sendSourceResponse(res, sourceResult);
  }

  const filePath = resolveFile(new URL(req.url ?? "/", `http://${req.headers.host}`).pathname);
  if (filePath) {
    return sendFile(res, filePath);
  }

  const fallback = resolveFile("/index.html");
  if (fallback) {
    return sendFile(res, fallback);
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`CinéVault production server listening on http://0.0.0.0:${port}`);
});
