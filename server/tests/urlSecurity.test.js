import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPublicHttpsUrl,
  isBlockedNetworkHost,
} from "../lib/urlSecurity.js";
import {
  assertProxiedStreamUrl,
  isAllowedProxiedStreamHost,
} from "../lib/embedResolvers.js";

test("isBlockedNetworkHost rejects private and local targets", () => {
  assert.equal(isBlockedNetworkHost("localhost"), true);
  assert.equal(isBlockedNetworkHost("127.0.0.1"), true);
  assert.equal(isBlockedNetworkHost("192.168.1.4"), true);
  assert.equal(isBlockedNetworkHost("10.0.0.5"), true);
  assert.equal(isBlockedNetworkHost("metadata.google.internal"), true);
  assert.equal(isBlockedNetworkHost("vidzy.cc"), false);
});

test("assertPublicHttpsUrl rejects non-https and internal urls", () => {
  assert.throws(() => assertPublicHttpsUrl("http://example.com/file"), /HTTPS/);
  assert.throws(() => assertPublicHttpsUrl("https://127.0.0.1/file"), /non autorisée/i);
  assert.equal(assertPublicHttpsUrl("https://example.com/file"), "https://example.com/file");
});

test("assertProxiedStreamUrl rejects generic cdns and localhost", () => {
  assert.throws(() => assertProxiedStreamUrl("https://127.0.0.1/stream.m3u8"));
  assert.throws(() => assertProxiedStreamUrl("https://d123.cloudfront.net/stream.m3u8"));
  assert.throws(() => assertProxiedStreamUrl("https://proxy.workers.dev/stream.m3u8"));
  assert.equal(
    assertProxiedStreamUrl("https://strm10.uqload.net/hls2/demo/master.m3u8"),
    "https://strm10.uqload.net/hls2/demo/master.m3u8",
  );
});

test("isAllowedProxiedStreamHost keeps known stream hosts only", () => {
  assert.equal(isAllowedProxiedStreamHost("strm10.uqload.net"), true);
  assert.equal(isAllowedProxiedStreamHost("fsvid.lol"), true);
  assert.equal(isAllowedProxiedStreamHost("d111.cloudfront.net"), false);
});
