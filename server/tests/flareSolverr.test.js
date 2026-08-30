import test from "node:test";
import assert from "node:assert/strict";
import { configureFlareSolverr, getFlareSolverrConfig } from "../lib/flareSolverrConfig.js";
import { fetchHtmlViaFlareSolverr, isFlareProxyUrl, tryFlareSolverrHtml } from "../lib/flareSolverr.js";
import {
  BUILTIN_FLARESOLVERR_URL,
  getDefaultFlareSolverrUrl,
  normalizeFlareSolverrUrl,
} from "../../src/lib/settings/flareSolverrUrl.js";

test("normalizeFlareSolverrUrl trims trailing slash and keeps origin", () => {
  assert.equal(normalizeFlareSolverrUrl("http://127.0.0.1:8191/"), "http://127.0.0.1:8191");
  assert.equal(normalizeFlareSolverrUrl("https://flare.example.com/v1"), "https://flare.example.com/v1");
  assert.equal(normalizeFlareSolverrUrl("ftp://bad"), "");
  assert.equal(normalizeFlareSolverrUrl(""), "");
});

test("getDefaultFlareSolverrUrl points to the VPS instance", () => {
  const previousUrl = process.env.FLARESOLVERR_URL;
  const previousVite = process.env.VITE_FLARESOLVERR_URL;
  delete process.env.FLARESOLVERR_URL;
  delete process.env.VITE_FLARESOLVERR_URL;
  try {
    assert.equal(getDefaultFlareSolverrUrl(), BUILTIN_FLARESOLVERR_URL);
    assert.equal(BUILTIN_FLARESOLVERR_URL, "https://nightnovelapp.tech/api/public/flare");
  } finally {
    if (previousUrl == null) delete process.env.FLARESOLVERR_URL;
    else process.env.FLARESOLVERR_URL = previousUrl;
    if (previousVite == null) delete process.env.VITE_FLARESOLVERR_URL;
    else process.env.VITE_FLARESOLVERR_URL = previousVite;
  }
});

test("isFlareProxyUrl detects the Night-Novel proxy path", () => {
  assert.equal(isFlareProxyUrl("https://nightnovelapp.tech/api/public/flare"), true);
  assert.equal(isFlareProxyUrl("https://nightnovelapp.tech/api/public/flare/"), true);
  assert.equal(isFlareProxyUrl("http://127.0.0.1:8191"), false);
});

test("fetchHtmlViaFlareSolverr returns solution HTML", async () => {
  const calls = [];
  const html = await fetchHtmlViaFlareSolverr("https://mangalik.net/manga/", {
    baseUrl: "http://127.0.0.1:8191",
    fetchImpl: async (endpoint, options) => {
      calls.push({ endpoint, headers: options.headers, body: JSON.parse(options.body) });
      return {
        async json() {
          return {
            status: "ok",
            solution: {
              response: "<html><body><div class='page-item-detail manga'>ok</div></body></html>",
            },
          };
        },
      };
    },
  });
  assert.match(html, /page-item-detail/);
  assert.equal(calls[0].endpoint, "http://127.0.0.1:8191/v1");
  assert.equal(calls[0].body.cmd, "request.get");
  assert.equal(calls[0].body.url, "https://mangalik.net/manga/");
  assert.equal(calls[0].headers.Authorization, undefined);
});

test("fetchHtmlViaFlareSolverr sends Basic Auth when configured", async () => {
  const calls = [];
  await fetchHtmlViaFlareSolverr("https://mangalik.net/manga/", {
    baseUrl: "http://127.0.0.1:8191",
    basicUser: "manhaw",
    basicPassword: "secret",
    fetchImpl: async (_endpoint, options) => {
      calls.push({ headers: options.headers });
      return {
        async json() {
          return {
            status: "ok",
            solution: {
              response: "<html><body><div class='page-item-detail manga'>ok</div></body></html>",
            },
          };
        },
      };
    },
  });
  assert.equal(
    calls[0].headers.Authorization,
    `Basic ${Buffer.from("manhaw:secret", "utf8").toString("base64")}`,
  );
});

test("fetchHtmlViaFlareSolverr uses the Night-Novel proxy contract", async () => {
  const calls = [];
  const html = await fetchHtmlViaFlareSolverr("https://kolnovel.com/chapter-1", {
    baseUrl: "https://nightnovelapp.tech/api/public/flare",
    basicUser: "manhaw",
    basicPassword: "should-not-be-sent",
    fetchImpl: async (endpoint, options) => {
      calls.push({ endpoint, headers: options.headers, body: JSON.parse(options.body) });
      return {
        ok: true,
        async json() {
          return {
            success: true,
            html: "<html><body><div class='page-item-detail manga'>ok</div></body></html>",
          };
        },
      };
    },
  });
  assert.match(html, /page-item-detail/);
  assert.equal(calls[0].endpoint, "https://nightnovelapp.tech/api/public/flare/solve");
  assert.deepEqual(calls[0].body, { url: "https://kolnovel.com/chapter-1" });
  assert.equal(calls[0].headers.Authorization, undefined);
});

test("tryFlareSolverrHtml returns null when not configured", async () => {
  configureFlareSolverr(() => null);
  const html = await tryFlareSolverrHtml("https://example.com/");
  assert.equal(html, null);
});

test("tryFlareSolverrHtml uses configured base URL", async () => {
  const originalFetch = globalThis.fetch;
  configureFlareSolverr(() => ({ baseUrl: "http://127.0.0.1:8191" }));
  globalThis.fetch = async () => ({
    async json() {
      return {
        status: "ok",
        solution: {
          response: "<html><body><div class='manga-item'>ok</div></body></html>",
        },
      };
    },
  });
  try {
    const html = await tryFlareSolverrHtml("https://mangalik.net/manga/");
    assert.match(html, /manga-item/);
  } finally {
    globalThis.fetch = originalFetch;
    configureFlareSolverr(() => null);
  }
});

test("getFlareSolverrConfig falls back to the VPS URL when unset", () => {
  configureFlareSolverr(null);
  try {
    const config = getFlareSolverrConfig();
    assert.equal(config?.baseUrl, BUILTIN_FLARESOLVERR_URL);
  } finally {
    configureFlareSolverr(() => null);
  }
});
