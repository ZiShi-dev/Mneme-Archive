import test from "node:test";
import assert from "node:assert/strict";
import { applySecurityHeaders } from "../lib/securityHeaders.js";

test("CSP allows MSE blob media used by hls.js", () => {
  const headers = {};
  applySecurityHeaders({
    setHeader(name, value) {
      headers[name] = value;
    },
  });
  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /media-src[^;]*blob:/);
  assert.match(csp, /worker-src[^;]*blob:/);
  assert.match(csp, /script-src[^;]*blob:/);
});
