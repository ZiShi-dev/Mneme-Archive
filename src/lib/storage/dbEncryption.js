import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite } from "@capacitor-community/sqlite";
import { t } from "../../i18n/runtime.js";

function createPassphrase() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error(t("errors.encryptionKey"));
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const passphrase = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (passphrase.length < 32) {
    throw new Error(t("errors.encryptionKey"));
  }  return passphrase;
}

export async function shouldUseDatabaseEncryption(sqliteConnection) {
  if (!Capacitor.isNativePlatform()) return false;
  const inConfig = (await sqliteConnection.isInConfigEncryption()).result;
  return Boolean(inConfig);
}

async function isEncryptionSecretStored() {
  const response = await CapacitorSQLite.isSecretStored();
  return Boolean(response?.result);
}

export async function ensureEncryptionSecret() {
  if (await isEncryptionSecretStored()) return;

  const passphrase = createPassphrase();
  try {
    await CapacitorSQLite.setEncryptionSecret({ passphrase });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already been set") || message.includes("already set")) return;
    if (message.includes("passphrase must not be empty")) {
      await CapacitorSQLite.clearEncryptionSecret().catch(() => {});
      await CapacitorSQLite.setEncryptionSecret({ passphrase });
      return;
    }
    throw error;
  }
}

function isUnknownDatabaseError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Database unknown") || message.includes("does not exist");
}

async function resetUnknownDatabase(sqliteConnection, databaseName) {
  try {
    await sqliteConnection.deleteDatabase(databaseName);
  } catch {
    // La base peut déjà être absente ou verrouillée ; on tente quand même une recréation.
  }
}

export async function resolveExistingDatabaseOpenOptions(sqliteConnection, databaseName) {
  const exists = (await sqliteConnection.isDatabase(databaseName)).result;
  if (!exists) {
    return { encrypted: true, mode: "secret" };
  }

  try {
    const isEncrypted = (await sqliteConnection.isDatabaseEncrypted(databaseName)).result;
    if (isEncrypted) {
      return { encrypted: true, mode: "secret" };
    }

    return { encrypted: true, mode: "encryption" };
  } catch (error) {
    if (!isUnknownDatabaseError(error)) throw error;
    await resetUnknownDatabase(sqliteConnection, databaseName);
    return { encrypted: true, mode: "secret" };
  }
}

export async function resolveDatabaseOpenOptions(sqliteConnection, databaseName) {
  const encryptionActive = await shouldUseDatabaseEncryption(sqliteConnection);
  if (!encryptionActive) {
    return { encrypted: false, mode: "no-encryption" };
  }

  await ensureEncryptionSecret();
  return resolveExistingDatabaseOpenOptions(sqliteConnection, databaseName);
}
