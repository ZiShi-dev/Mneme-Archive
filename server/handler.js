import { responseJson } from "./lib/responseJson.js";
import { toPublicSourceError } from "./lib/errors.js";
import { handleFollowLatestRequest } from "./lib/followLatestChapter.js";
import { resolveSourceHandler } from "./lib/sourceRegistry.js";

export async function handleSourceRequest(rawUrl, request = {}) {
  const handler = resolveSourceHandler(rawUrl);
  if (!handler) return null;
  try {
    const requestUrl = new URL(rawUrl, "http://localhost");
    if (requestUrl.pathname.endsWith("/follow-latest")) {
      return await handleFollowLatestRequest(requestUrl, request, handler);
    }
    return await handler(requestUrl, request);
  } catch (error) {
    return responseJson(502, { error: toPublicSourceError(error) });
  }
}
