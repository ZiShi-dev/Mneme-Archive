import test from "node:test";
import assert from "node:assert/strict";
import { toPublicSourceError } from "../lib/errors.js";

test("toPublicSourceError returns generic message", () => {
  const message = toPublicSourceError(new Error("MangaLik a répondu 502 avec stack trace"));
  assert.equal(message, "المصدر غير متاح حالياً");
});

test("toPublicSourceError preserves Arabic messages", () => {
  const message = toPublicSourceError(new Error("حماية Arabs Hentai منعت الاتصال مؤقتًا"));
  assert.equal(message, "حماية Arabs Hentai منعت الاتصال مؤقتًا");
});
