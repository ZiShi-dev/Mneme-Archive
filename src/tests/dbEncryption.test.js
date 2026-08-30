import test from "node:test";
import assert from "node:assert/strict";
import { resolveExistingDatabaseOpenOptions } from "../lib/storage/dbEncryption.js";

function createSqliteConnectionMock(overrides = {}) {
  return {
    isDatabase: async () => ({ result: true }),
    isDatabaseEncrypted: async () => ({ result: true }),
    deleteDatabase: async () => {},
    ...overrides,
  };
}

test("resolveExistingDatabaseOpenOptions recreates database when encryption state is unknown", async () => {
  let deleted = false;
  const sqliteConnection = createSqliteConnectionMock({
    isDatabaseEncrypted: async () => {
      throw new Error("isDatabaseEncrypted: Database unknown");
    },
    deleteDatabase: async () => {
      deleted = true;
    },
  });

  const options = await resolveExistingDatabaseOpenOptions(sqliteConnection, "living_archive");

  assert.equal(deleted, true);
  assert.deepEqual(options, { encrypted: true, mode: "secret" });
});

test("resolveExistingDatabaseOpenOptions migrates legacy plaintext databases", async () => {
  const sqliteConnection = createSqliteConnectionMock({
    isDatabaseEncrypted: async () => ({ result: false }),
  });

  const options = await resolveExistingDatabaseOpenOptions(sqliteConnection, "living_archive");

  assert.deepEqual(options, { encrypted: true, mode: "encryption" });
});
