import test from "node:test";
import assert from "node:assert/strict";
import { assertCoflixStreamReferer } from "../sources/coflix.js";

const ctx = { baseUrl: "https://coflix.esq", baseHost: "coflix.esq" };

test("assertCoflixStreamReferer accepts coflix pages", () => {
  assert.equal(
    assertCoflixStreamReferer("https://coflix.esq/film/jack-reacher/", ctx),
    "https://coflix.esq/film/jack-reacher/",
  );
});

test("assertCoflixStreamReferer rejects external referers", () => {
  assert.throws(
    () => assertCoflixStreamReferer("https://evil.example/watch", ctx),
    /غير صالح/,
  );
});
