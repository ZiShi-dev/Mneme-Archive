import { applySecurityHeaders } from "./securityHeaders.js";

export function responseJson(status, body) {
  return { kind: "json", status, body };
}

export function sendSourceResponse(res, result) {
  applySecurityHeaders(res);
  if (result.kind === "image" || result.kind === "stream") {
    res.statusCode = 200;
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", result.cacheControl || (result.kind === "stream" ? "no-store" : "public, max-age=86400, immutable"));
    res.end(result.buffer);
    return;
  }
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(result.body));
}
