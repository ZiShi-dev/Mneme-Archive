import test from "node:test";
import assert from "node:assert/strict";
import { publicFetch, configurePublicFetchTransport } from "../lib/publicFetch.js";
import { createPublicLookup, createPublicDispatcher, installPublicFetchTransport } from "../lib/publicFetchNode.js";
import { fetch as undiciFetch } from "undici";
import { fetchHtmlViaFlareSolverr } from "../lib/flareSolverr.js";
import { isBlockedNetworkHost, assertPublicHttpsUrl } from "../lib/urlSecurity.js";

test("blocks non-public IPv4, IPv6, mapped addresses and URL obfuscation", async () => {
  for (const host of ["::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "fc00::1", "fe80::1", "ff02::1", "100.64.0.1", "224.0.0.1", "192.0.2.1", "localhost."]) {
    assert.equal(isBlockedNetworkHost(host), true, host);
  }
  for (const url of ["https://2130706433", "https://0x7f000001", "https://127.1", "https://user:pass@example.com", "file:///etc/passwd"]) {
    assert.throws(() => assertPublicHttpsUrl(url));
    await assert.rejects(publicFetch(url));
  }
  assert.equal(isBlockedNetworkHost("8.8.8.8"), false);
  assert.equal(isBlockedNetworkHost("2606:4700:4700::1111"), false);
});

function lookupResult(addresses, options = {}) {
  let calls = 0;
  const lookup = createPublicLookup((_host, init, callback) => {
    calls++;
    assert.equal(init.all, true);
    callback(null, addresses);
  });
  return new Promise((resolve, reject) => lookup("source.example", options, (error, address, family) => {
    if (error) reject(error);
    else resolve({ address, family, calls });
  }));
}

test("DNS lookup rejects private results including mixed public/private answers", async () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "::ffff:10.0.0.1", "fd00::1"]) {
    await assert.rejects(lookupResult([{ address: "8.8.8.8", family: 4 }, { address, family: address.includes(":") ? 6 : 4 }]), /DNS non autorisée/);
  }
  await assert.rejects(lookupResult([]), /DNS non autorisée/);
});

test("DNS lookup returns the checked IP directly without a second resolution", async () => {
  assert.deepEqual(await lookupResult([{ address: "8.8.8.8", family: 4 }]), {
    address: "8.8.8.8", family: 4, calls: 1,
  });
  const addresses = [{ address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
  assert.deepEqual((await lookupResult(addresses, { all: true })).address, addresses);
});

test("redirects to private destinations and HTTPS downgrade never issue a second request", async () => {
  for (const location of ["https://127.0.0.1/admin", "https://[::ffff:127.0.0.1]/", "http://example.com", "https://user:pass@example.com"]) {
    let calls = 0;
    let cancelled = false;
    configurePublicFetchTransport(async () => {
      calls++;
      return { status: 302, headers: new Headers({ location }), body: { cancel: async () => { cancelled = true; } } };
    });
    try {
      await assert.rejects(publicFetch("https://example.com"));
      assert.equal(calls, 1);
      assert.equal(cancelled, true);
    } finally { configurePublicFetchTransport(undefined); }
  }
});

test("public relative redirects preserve Range; cross-origin redirects strip credentials", async () => {
  const calls = [];
  configurePublicFetchTransport(async (url, init) => {
    calls.push({ url, init });
    const location = calls.length === 1 ? "/next" : "https://cdn.example.org/video";
    return calls.length < 3 ? new Response(null, { status: 302, headers: { location } }) : new Response("ok");
  });
  try {
    const result = await publicFetch("https://example.com/start", { headers: { Authorization: "secret", Cookie: "secret", Range: "bytes=0-7" } });
    assert.equal(await result.text(), "ok");
    assert.equal(calls[1].url, "https://example.com/next");
    assert.equal(calls[1].init.headers.get("authorization"), "secret");
    assert.equal(calls[2].init.headers.get("authorization"), null);
    assert.equal(calls[2].init.headers.get("cookie"), null);
    assert.equal(calls[2].init.headers.get("range"), "bytes=0-7");
    assert.ok(calls.every(({ init }) => init.redirect === "manual"));
  } finally { configurePublicFetchTransport(undefined); }
});

test("redirect loops are bounded and POST 303 becomes GET", async () => {
  let calls = 0;
  configurePublicFetchTransport(async (_url, init) => {
    calls++;
    if (calls > 1) {
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(init.headers.get("content-type"), null);
    }
    return new Response(null, { status: 303, headers: { location: "/loop" } });
  });
  try {
    await assert.rejects(publicFetch("https://example.com", { method: "POST", body: "data", headers: { "content-type": "text/plain" } }), /trop nombreuses/);
    assert.equal(calls, 6);
  } finally { configurePublicFetchTransport(undefined); }
});

test("installed Node transport uses a protected dispatcher and preserves cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  installPublicFetchTransport();
  globalThis.fetch = async (_url, init) => {
    assert.ok(init.dispatcher);
    assert.equal(init.signal, controller.signal);
    assert.equal(init.redirect, "manual");
    return new Response("ok");
  };
  try {
    await publicFetch("https://example.com", { signal: controller.signal });
    controller.abort();
    await assert.rejects(publicFetch("https://example.com", { signal: controller.signal }), { name: "AbortError" });
  } finally {
    globalThis.fetch = original;
    configurePublicFetchTransport(undefined);
  }
});

test("actual HTTP transport refuses a hostname resolving to loopback before connection", async () => {
  let resolutions = 0;
  const dispatcher = createPublicDispatcher((_hostname, _options, callback) => {
    resolutions++;
    callback(null, [{ address: "127.0.0.1", family: 4 }]);
  });
  try {
    await assert.rejects(undiciFetch("http://source.example:8191/private", { dispatcher }),
      (error) => /DNS non autorisée/.test(error.cause?.message));
    assert.equal(resolutions, 1);
  } finally { await dispatcher.close(); }
});

test("FlareSolverr rejects private targets before contacting the configured solver", async () => {
  let calls = 0;
  await assert.rejects(fetchHtmlViaFlareSolverr("https://127.0.0.1/private", {
    baseUrl: "http://127.0.0.1:8191",
    fetchImpl: async () => { calls++; },
  }), /non autorisée/);
  assert.equal(calls, 0);
});

test("delegated fetches run the installed destination validator", async () => {
  configurePublicFetchTransport(undefined, async () => { throw new Error("Destination DNS non autorisée"); });
  try {
    await assert.rejects(fetchHtmlViaFlareSolverr("https://source.example", {
      baseUrl: "http://127.0.0.1:8191",
      fetchImpl: async () => assert.fail("solver must not be contacted"),
    }), /DNS non autorisée/);
  } finally { configurePublicFetchTransport(undefined); }
});
