import test from "node:test";
import assert from "node:assert/strict";
import { applySecurityHeaders, PROD_CSP, DEV_CSP } from "../lib/securityHeaders.js";

test("CSP allows MSE blob media used by hls.js", () => {
  const headers = {};
  applySecurityHeaders({
    setHeader(name, value) {
      headers[name] = value;
    },
  }, { production: false });
  const csp = headers["Content-Security-Policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /media-src[^;]*blob:/);
  assert.match(csp, /worker-src[^;]*blob:/);
  assert.match(csp, /script-src[^;]*blob:/);
});

test("production CSP removes unsafe eval and enables HSTS", () => {
  const headers = {};
  applySecurityHeaders({
    setHeader(name, value) {
      headers[name] = value;
    },
  }, { production: true });

  assert.equal(headers["Content-Security-Policy"], PROD_CSP);
  assert.doesNotMatch(headers["Content-Security-Policy"], /unsafe-eval/);
  assert.match(headers["Strict-Transport-Security"], /max-age=31536000/);
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
});

test("development CSP keeps unsafe eval for Vite", () => {
  assert.match(DEV_CSP, /unsafe-eval/);
});
