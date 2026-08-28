import { openDatabase } from "./database";
import { initKvStore } from "./kvStore";
import { migrateFromLegacyLocalStorage } from "./migrate";
import { migrateChapterReadLogBackfill } from "./migrateChapterReadLog";
import { initNetworkStatus } from "../platform/networkStatus";

let initPromise = null;

export async function initStorage() {
  if (!initPromise) {
    initPromise = (async () => {
      await initNetworkStatus();
      await openDatabase();
      await initKvStore();
      await migrateFromLegacyLocalStorage();
      await migrateChapterReadLogBackfill();
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export { clearImageCache } from "./imageCache";
export {
  kvGet,
  kvGetStringSync,
  kvGetSync,
  kvHasSync,
  kvRemove,
  kvSet,
  kvSetString,
} from "./kvStore";
