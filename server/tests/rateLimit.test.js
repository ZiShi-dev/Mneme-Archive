import test from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  shouldRateLimitSourceRequest,
} from "../lib/rateLimit.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body;
      this.writableEnded = true;
    },
  };
}

test("shouldRateLimitSourceRequest targets source api only", () => {
  assert.equal(shouldRateLimitSourceRequest("/api/sources/wiflix/catalog"), true);
  assert.equal(shouldRateLimitSourceRequest("/index.html"), false);
});

test("createRateLimiter blocks after max requests", () => {
  const check = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
  const req = { headers: {}, socket: { remoteAddress: "203.0.113.10" } };
  const first = mockResponse();
  const second = mockResponse();
  const third = mockResponse();

  assert.equal(check(req, first), false);
  assert.equal(check(req, second), false);
  assert.equal(check(req, third), true);
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers["Retry-After"], "60");
});
