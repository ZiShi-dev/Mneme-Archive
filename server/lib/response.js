import { Readable } from "node:stream";
import { applySecurityHeaders } from "./securityHeaders.js";

export function responseJson(status, body) {
  return { kind: "json", status, body };
}

function setOptionalHeader(res, name, value) {
  if (value === undefined || value === null || value === "") return;
  res.setHeader(name, value);
}

export function sendSourceResponse(res, result, req = null) {
  applySecurityHeaders(res);
  if (result.kind === "stream-pipe") {
    res.statusCode = result.status || 200;
    res.setHeader("Content-Type", result.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", result.cacheControl || "no-store");
    setOptionalHeader(res, "Content-Length", result.contentLength);
    setOptionalHeader(res, "Content-Range", result.contentRange);
    setOptionalHeader(res, "Accept-Ranges", result.acceptRanges || "bytes");
    if (!result.body) {
      res.end();
      return;
    }
    const nodeStream = typeof result.body.pipe === "function"
      ? result.body
      : Readable.fromWeb(result.body);
    const abort = () => {
      try { nodeStream.destroy?.(); } catch { /* ignore */ }
    };
    req?.once?.("close", abort);
    nodeStream.on("error", abort);
    nodeStream.pipe(res);
    return;
  }
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
