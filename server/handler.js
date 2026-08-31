import { responseJson } from "./lib/response.js";
import { toPublicSourceError } from "./lib/errors.js";
import { resolveSourceHandler } from "./lib/sourceRegistry.js";

export async function handleSourceRequest(rawUrl, request = {}) {
  const handler = resolveSourceHandler(rawUrl);
  if (!handler) return null;
  try {
    const requestUrl = new URL(rawUrl, "http://localhost");
    return await handler(requestUrl, request);
  } catch (error) {
    return responseJson(502, { error: toPublicSourceError(error) });
  }
}
