import test from "node:test";
import assert from "node:assert/strict";
import { toPublicSourceError } from "../lib/errors.js";

test("toPublicSourceError returns generic message", () => {
  const message = toPublicSourceError(new Error("MangaLik a répondu 502 avec stack trace"));
  assert.equal(message, "المصدر غير متاح حالياً");
});

test("toPublicSourceError preserves Arabic messages", () => {
  const message = toPublicSourceError(new Error("حماية MangaLik المؤقتة منعت الاتصال، أعد المحاولة بعد قليل"));
  assert.equal(message, "حماية MangaLik المؤقتة منعت الاتصال، أعد المحاولة بعد قليل");
});

test("toPublicSourceError maps Flare/Cloudflare failures", () => {
  const message = toPublicSourceError(new Error("FlareSolverr surchargé (Chrome a planté). Réessaie dans quelques secondes."));
  assert.equal(message, "حماية Cloudflare منعت الاتصال مؤقتًا، أعد المحاولة بعد قليل");
});
