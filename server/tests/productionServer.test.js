import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startProductionServer, stopProductionServer } from "../productionServer.js";

const distRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "dist");

async function withServer(options, run) {
  const started = await startProductionServer(options);
  try {
    return await run(started);
  } finally {
    await stopProductionServer(started.server);
  }
}

test("startProductionServer serves index.html from dist", async () => {
  await withServer({ port: 0, host: "127.0.0.1", root: distRoot }, async ({ url }) => {
    const response = await fetch(`${url}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html/i);
    assert.match(html, /CineVault|root/i);
  });
});

test("startProductionServer falls back to SPA index for unknown routes", async () => {
  await withServer({ port: 0, host: "127.0.0.1", root: distRoot }, async ({ url }) => {
    const response = await fetch(`${url}/settings/notifications`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html/i);
  });
});

test("stopProductionServer closes listening socket", async () => {
  const started = await startProductionServer({ port: 0, host: "127.0.0.1", root: distRoot });
  assert.equal(started.server.listening, true);
  await stopProductionServer(started.server);
  assert.equal(started.server.listening, false);
});
