import { handleSourceRequest } from "./handler.js";
import { createSecurityHeadersMiddleware } from "./lib/securityHeaders.js";
import { sendSourceResponse } from "./lib/response.js";

export { handleSourceRequest } from "./handler.js";

function createSourcesAdapter() {
  const securityHeaders = createSecurityHeadersMiddleware();
  const handler = async (req, res, next) => {
    const result = await handleSourceRequest(req.url ?? "");
    if (!result) return next();
    return sendSourceResponse(res, result);
  };
  return {
    name: "manga-sources-adapter",
    configureServer(server) {
      server.middlewares.use(securityHeaders);
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(securityHeaders);
      server.middlewares.use(handler);
    },
  };
}

export function mangaSourcesPlugin() {
  return createSourcesAdapter();
}
