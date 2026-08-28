import test from "node:test";
import assert from "node:assert/strict";
import { interpolate, lookup, translate } from "../i18n/translate.js";
import { ar } from "../i18n/ar.js";
import { fr } from "../i18n/fr.js";
import { setRuntimeLocale, t } from "../i18n/runtime.js";

test("lookup reads nested keys", () => {
  assert.equal(lookup(ar, "nav.home"), "الرئيسية");
  assert.equal(lookup(fr, "nav.home"), "Accueil");
});

test("interpolate replaces named placeholders", () => {
  assert.equal(interpolate("{enabled} / {total}", { enabled: 12, total: 13 }), "12 / 13");
});

test("translate falls back to Arabic then to the key", () => {
  assert.equal(translate(fr, "nav.home", {}, ar), "Accueil");
  assert.equal(translate(fr, "missing.key", {}, ar), "missing.key");
});

test("runtime t switches between Arabic and French", () => {
  setRuntimeLocale("ar");
  assert.equal(t("settings.enableSources"), "تفعيل المصادر");
  setRuntimeLocale("fr");
  assert.equal(t("settings.enableSources"), "Activer les sources");
  assert.equal(t("sources.enabledOfTotal", { enabled: 3, total: 13 }), "3 actives sur 13");
  setRuntimeLocale("ar");
});
