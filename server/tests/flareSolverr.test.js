import test from "node:test";
import assert from "node:assert/strict";
import { configureFlareSolverr, getFlareSolverrConfig } from "../lib/flareSolverrConfig.js";
import { fetchHtmlViaFlareSolverr, isFlareProxyUrl, requireFlareSolverrHtml, tryFlareSolverrHtml } from "../lib/flareSolverr.js";
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

test("fetchHtmlViaFlareSolverr maps a Cloudflare 502 HTML page", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchHtmlViaFlareSolverr("https://kolnovel.com/series/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: false,
          status: 502,
          async text() {
            return "<html><title>nightnovelapp.tech | 502: Bad gateway</title></html>";
          },
        };
      },
    }),
    /proxy Night-Novel|Cloudflare/,
  );
  // Pas de retry sur 502 : sinon le catalogue reste ~2 minutes en chargement.
  assert.equal(calls, 1);
});

test("fetchHtmlViaFlareSolverr ne retente pas quand l'IP serveur est bannie", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchHtmlViaFlareSolverr("https://mangalik.net/manga/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: true,
          async text() {
            return JSON.stringify({
              success: false,
              error: "Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.",
            });
          },
        };
      },
    }),
    /bloqué l'IP/i,
  );
  assert.equal(calls, 1);
});

test("fetchHtmlViaFlareSolverr rejects HTML from another host", async () => {
  await assert.rejects(
    () => fetchHtmlViaFlareSolverr("https://arabshentai.com/manga/x/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({
            success: true,
            html: '<html><link rel="pingback" href="https://mangalik.net/xmlrpc.php"><title>XML Sitemap</title></html>',
          });
        },
      }),
    }),
    /autre site/,
  );
});

test("fetchHtmlViaFlareSolverr accepts Novels Paradise HTML with late hostname", async () => {
  const padding = "<!--".padEnd(9000, "x") + "-->";
  const html = await fetchHtmlViaFlareSolverr("https://novelsparadise.site/series/", {
    baseUrl: "https://nightnovelapp.tech/api/public/flare",
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return JSON.stringify({
          success: true,
          html: `${padding}<html><link rel="canonical" href="https://novelsparadise.site/series/" /><article class="maindet">ok</article></html>`,
        });
      },
    }),
  });
  assert.match(html, /maindet/);
});

test("fetchHtmlViaFlareSolverr rejects mangalik catalog HTML for a chapter URL", async () => {
  await assert.rejects(
    () => fetchHtmlViaFlareSolverr("https://mangalik.net/manga/villain-is-here/352/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({
            success: true,
            html: '<html><link rel="canonical" href="https://mangalik.net/manga/"><div class="page-item-detail manga">catalog</div></html>',
          });
        },
      }),
    }),
    /autre site|page d'un autre site/i,
  );
});

test("fetchHtmlViaFlareSolverr accepts mangalik chapter HTML with image markers", async () => {
  const html = await fetchHtmlViaFlareSolverr("https://mangalik.net/manga/villain-is-here/352/", {
    baseUrl: "https://nightnovelapp.tech/api/public/flare",
    fetchImpl: async () => ({
      ok: true,
      async text() {
        return JSON.stringify({
          success: true,
          html: '<html><h1 id="chapter-heading">Ch</h1><img class="wp-manga-chapter-img" src="https://tempsolo.mangalik.net/manga/x/1.jpg"></html>',
        });
      },
    }),
  });
  assert.match(html, /wp-manga-chapter-img/);
});

test("fetchHtmlViaFlareSolverr inlines chapter images from the proxy", async () => {
  const html = await fetchHtmlViaFlareSolverr("https://mangalik.net/manga/x/ch-1/", {
    baseUrl: "https://nightnovelapp.tech/api/public/flare",
    includeAssets: true,
    fetchImpl: async (_endpoint, options) => {
      assert.deepEqual(JSON.parse(options.body), {
        url: "https://mangalik.net/manga/x/ch-1/",
        includeAssets: true,
      });
      return {
        ok: true,
        async json() {
          return {
            success: true,
            html: '<img class="wp-manga-chapter-img" src="https://mangalik.net/page.jpg">',
            assets: [{
              url: "https://mangalik.net/page.jpg",
              contentType: "image/jpeg",
              base64: Buffer.from("abc").toString("base64"),
            }],
          };
        },
      };
    },
  });
  assert.match(html, /data:image\/jpeg;base64,/);
});

test("tryFlareSolverrHtml returns null when not configured", async () => {
  configureFlareSolverr(() => null);
  const html = await tryFlareSolverrHtml("https://example.com/");
  assert.equal(html, null);
});

test("requireFlareSolverrHtml throws when not configured", async () => {
  configureFlareSolverr(() => null);
  await assert.rejects(
    () => requireFlareSolverrHtml("https://mangalik.net/manga/"),
    /FlareSolverr non configuré/,
  );
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

test("fetchHtmlViaFlareSolverr maps Chrome tab crashes without retry storm", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchHtmlViaFlareSolverr("https://arabshentai.com/manga/x/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: false,
          status: 500,
          async text() {
            return JSON.stringify({
              status: "error",
              message: "Error: Error solving the challenge. Message: tab crashed",
            });
          },
        };
      },
    }),
    /surchargé|planté/i,
  );
  assert.equal(calls, 1);
});

test("fetchHtmlViaFlareSolverr serializes concurrent requests", async () => {
  let inFlight = 0;
  let peak = 0;
  const fetchImpl = async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 40));
    inFlight -= 1;
    return {
      ok: true,
      async text() {
        return JSON.stringify({
          success: true,
          html: "<html><body><div class='page-item-detail manga'>ok</div></body></html>",
        });
      },
    };
  };
  await Promise.all([
    fetchHtmlViaFlareSolverr("https://mangalik.net/manga/a/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl,
    }),
    fetchHtmlViaFlareSolverr("https://mangalik.net/manga/b/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl,
    }),
    fetchHtmlViaFlareSolverr("https://mangalik.net/manga/c/", {
      baseUrl: "https://nightnovelapp.tech/api/public/flare",
      fetchImpl,
    }),
  ]);
  assert.equal(peak, 1);
});
