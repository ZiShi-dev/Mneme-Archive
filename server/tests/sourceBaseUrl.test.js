import test from "node:test";
import assert from "node:assert/strict";
import {
  createHostContext,
  isAllowedSourceBaseHost,
  resolveRequestBaseUrl,
  resolveSourceRequestContext,
} from "../lib/sourceBaseUrl.js";

const MANGALIK_DEFAULT = "https://mangalik.net";

test("resolveRequestBaseUrl returns default when baseUrl param is absent", () => {
  const url = new URL("https://app.test/api/sources/mangalik/catalog");
  assert.equal(resolveRequestBaseUrl(url, MANGALIK_DEFAULT), MANGALIK_DEFAULT);
});

test("resolveRequestBaseUrl accepts same apex as default source", () => {
  const url = new URL("https://app.test/api/sources/mangalik/catalog?baseUrl=https%3A%2F%2Fwww.mangalik.net");
  assert.equal(resolveRequestBaseUrl(url, MANGALIK_DEFAULT), "https://www.mangalik.net");
});

test("resolveRequestBaseUrl rejects arbitrary external hosts", () => {
  const url = new URL("https://app.test/api/sources/mangalik/catalog?baseUrl=https%3A%2F%2Fevil.example");
  assert.throws(
    () => resolveRequestBaseUrl(url, MANGALIK_DEFAULT, { label: "MangaLik" }),
    /non autorisée/i,
  );
});

test("resolveRequestBaseUrl supports allowedHostPattern for known mirrors", () => {
  const url = new URL("https://app.test/api/sources/coflix/catalog?baseUrl=https%3A%2F%2Fcoflix.foo");
  assert.equal(
    resolveRequestBaseUrl(url, "https://coflix.esq", {
      label: "Coflix",
      allowedHostPattern: /^coflix\.[a-z0-9.-]+$/i,
    }),
    "https://coflix.foo",
  );
});

test("resolveSourceRequestContext builds host context from validated baseUrl", () => {
  const url = new URL("https://app.test/api/sources/mangalik/catalog");
  const ctx = resolveSourceRequestContext(url, MANGALIK_DEFAULT, { label: "MangaLik" });
  assert.equal(ctx.baseUrl, MANGALIK_DEFAULT);
  assert.equal(ctx.apex, "mangalik.net");
  assert.ok(ctx.hostPattern.test("cdn.mangalik.net"));
});

test("isAllowedSourceBaseHost blocks private network hosts", () => {
  assert.equal(isAllowedSourceBaseHost("mangalik.net", MANGALIK_DEFAULT), true);
  assert.equal(isAllowedSourceBaseHost("evil.example", MANGALIK_DEFAULT), false);
});

test("createHostContext normalizes apex without www", () => {
  const ctx = createHostContext("https://www.example.com");
  assert.equal(ctx.apex, "example.com");
  assert.ok(ctx.allowedHosts.has("www.example.com"));
});
