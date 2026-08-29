import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { handleSourceRequest } from "./handler.js";
import { applySecurityHeaders } from "./lib/securityHeaders.js";
import { createRateLimiter, shouldRateLimitSourceRequest } from "./lib/rateLimit.js";
import { sendSourceResponse } from "./lib/response.js";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const defaultPort = Number(process.env.PORT) || 4173;

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

function resolveFile(root, urlPath) {
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

export function startProductionServer(options = {}) {
  const root = options.root ?? defaultRoot;
  const port = options.port ?? defaultPort;
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
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

    const filePath = resolveFile(root, new URL(req.url ?? "/", `http://${req.headers.host}`).pathname);
    if (filePath) {
      return sendFile(res, filePath);
    }

    const fallback = resolveFile(root, "/index.html");
    if (fallback) {
      return sendFile(res, fallback);
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      const listeningPort = typeof address === "object" && address ? address.port : port;
      const urlHost = host === "0.0.0.0" ? "127.0.0.1" : host;
      resolve({
        server,
        port: listeningPort,
        host,
        url: `http://${urlHost}:${listeningPort}`,
        root,
      });
    });
  });
}

export function stopProductionServer(server) {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

const isDirectRun = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  startProductionServer().then(({ url }) => {
    console.log(`CinéVault production server listening on ${url}`);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
