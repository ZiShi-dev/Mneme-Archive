import { handleSourceRequest } from "./clientSourceRequest.js";
import { createSecurityHeadersMiddleware } from "./lib/securityHeaders.js";
import { createRateLimiter, shouldRateLimitSourceRequest } from "./lib/rateLimit.js";

export { handleSourceRequest } from "./clientSourceRequest.js";

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
    const { sendSourceResponse } = await import("./lib/response.js");
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
