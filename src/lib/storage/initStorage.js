import { openDatabase, resetDatabaseState } from "./database.js";
import { initKvStore, resetKvStore } from "./kvStore.js";
import { migrateFromLegacyLocalStorage } from "./migrate.js";
import { initNetworkStatus } from "../platform/networkStatus.js";

const BOOT_TIMEOUT_MS = 20000;

let initPromise = null;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Boot timeout: ${label}`));
    }, ms);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runStorageBootstrap() {
  await Promise.race([
    initNetworkStatus(),
    new Promise((resolve) => { setTimeout(resolve, 4000); }),
  ]);
  await openDatabase();
  await initKvStore();
  await migrateFromLegacyLocalStorage();
}

export function resetStorageInit() {
  initPromise = null;
  resetDatabaseState();
  resetKvStore();
}

export async function initStorage() {
  if (!initPromise) {
    initPromise = withTimeout(
      runStorageBootstrap(),
      BOOT_TIMEOUT_MS,
      "initStorage",
    ).catch((error) => {
      resetStorageInit();
      throw error;
    });
  }
  return initPromise;
}

export { clearImageCache } from "./imageCache";
export { clearAllLocalData, clearReadingData } from "./clearLocalData.js";
export {
  kvGet,
  kvGetStringSync,
  kvGetSync,
  kvHasSync,
  kvRemove,
  kvSet,
  kvSetString,
  persistStorageString,
} from "./kvStore";
export { peekStorageString } from "./peek.js";
