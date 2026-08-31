import { handleSourceRequest as handleSourceRequestCore } from "./handler.js";
import { createSecurityHeadersMiddleware } from "./lib/securityHeaders.js";
import { createRateLimiter, shouldRateLimitSourceRequest } from "./lib/rateLimit.js";
import { sendSourceResponse } from "./lib/response.js";

let nativeInitPromise = null;

async function ensureNativeSourceFetch() {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  if (!nativeInitPromise) {
    nativeInitPromise = import("../src/lib/platform/mangalikNative.js")
      .then((module) => module.initCloudflareNative())
      .catch(() => {});
  }
  await nativeInitPromise;
}

export async function handleSourceRequest(rawUrl, request = {}) {
  await ensureNativeSourceFetch();
  return handleSourceRequestCore(rawUrl, request);
}

function createSourcesAdapter() {
  const securityHeaders = createSecurityHeadersMiddleware();
  const checkRateLimit = createRateLimiter();
  const rateLimitMiddleware = (req, res, next) => {
    if (!shouldRateLimitSourceRequest(req.url ?? "")) return next();
    if (checkRateLimit(req, res)) return;
    return next();
  };
  const handler = async (req, res, next) => {
    const result = await handleSourceRequest(req.url ?? "", {
      method: req.method || "GET",
      headers: req.headers || {},
    });
    if (!result) return next();
    return sendSourceResponse(res, result, req);
  };
  return {
    name: "manga-sources-adapter",
    configureServer(server) {
      server.middlewares.use(securityHeaders);
      server.middlewares.use(rateLimitMiddleware);
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(createSecurityHeadersMiddleware({ production: true }));
      server.middlewares.use(rateLimitMiddleware);
      server.middlewares.use(handler);
    },
  };
}

export function mangaSourcesPlugin() {
  return createSourcesAdapter();
}
