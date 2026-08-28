import test from "node:test";
import assert from "node:assert/strict";
import { createHlsPlayerConfig, getVideoPreloadMode } from "../lib/hls/hlsConfig.js";

test("createHlsPlayerConfig uses smaller buffers on metered connections", () => {
  const config = createHlsPlayerConfig();
  if (config.startLevel === 0) {
    assert.equal(config.maxBufferLength, 12);
    assert.equal(config.maxMaxBufferLength, 24);
  } else {
    assert.equal(config.maxBufferLength, 30);
    assert.equal(config.maxMaxBufferLength, 60);
  }
});

test("getVideoPreloadMode avoids eager buffering on metered connections", () => {
  const mode = getVideoPreloadMode();
  assert.ok(mode === "metadata" || mode === "auto");
});
