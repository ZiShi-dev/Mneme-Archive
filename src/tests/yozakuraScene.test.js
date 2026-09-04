import test from "node:test";
import assert from "node:assert/strict";
import {
  isYozakuraCompact,
  isYozakuraLandscape,
  isYozakuraShortLandscape,
  isYozakuraWide,
  yozakuraMoonPosition,
  yozakuraMotionBudget,
  yozakuraTreeAnchors,
  yozakuraTreeUnit,
} from "../lib/theme/yozakuraScene.js";

test("yozakuraTreeUnit stays phone-sized on a tall phone", () => {
  assert.equal(yozakuraTreeUnit(390, 844), 390);
});

test("yozakuraTreeUnit does not explode on a tablet or desktop", () => {
  assert.equal(yozakuraTreeUnit(768, 1024), 560);
  assert.ok(yozakuraTreeUnit(1440, 900) <= 520);
});

test("landscape keeps trees scaled to the short side", () => {
  assert.equal(isYozakuraLandscape(844, 390), true);
  assert.equal(isYozakuraShortLandscape(844, 390), true);
  assert.ok(yozakuraTreeUnit(844, 390) <= 520);
});

test("wide viewports add gutter branches and park the moon aside", () => {
  assert.equal(isYozakuraWide(1280, 800), true);
  const { near, far } = yozakuraTreeAnchors(1280, 800);
  assert.ok(near.length > 5);
  assert.ok(far.length > 3);
  const moon = yozakuraMoonPosition(1280, 800, "frame");
  assert.ok(moon.x > 1280 * 0.8);
});

test("compact phones keep a tighter motion budget", () => {
  assert.equal(isYozakuraCompact(320, 568), true);
  const compact = yozakuraMotionBudget({ w: 320, h: 568, variant: "frame" });
  const phone = yozakuraMotionBudget({ w: 390, h: 844, variant: "frame" });
  assert.ok(compact.petals <= phone.petals);
  assert.ok(compact.dpr <= 1.5);
});

test("save-data and native reduce particles", () => {
  const open = yozakuraMotionBudget({ w: 390, h: 844, variant: "stage" });
  const saver = yozakuraMotionBudget({ w: 390, h: 844, variant: "stage", saveData: true });
  const native = yozakuraMotionBudget({ w: 390, h: 844, variant: "stage", native: true });
  assert.ok(saver.petals < open.petals);
  assert.ok(native.staticStars < open.staticStars);
  assert.equal(native.farTrees, false);
});
