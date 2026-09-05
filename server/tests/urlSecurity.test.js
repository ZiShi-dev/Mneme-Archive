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

test("isBlockedNetworkHost rejects mapped, reserved and multicast addresses", () => {
  for (const host of [
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "100.64.0.1",
    "224.0.0.1",
    "192.0.2.1",
    "localhost.",
  ]) {
    assert.equal(isBlockedNetworkHost(host), true, host);
  }
  assert.equal(isBlockedNetworkHost("8.8.8.8"), false);
  assert.equal(isBlockedNetworkHost("2606:4700:4700::1111"), false);
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
