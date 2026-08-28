import { assertAllowedKey } from "./security.js";

/** Lecture synchrone avant initKvStore — clé allowlistée, sans dépendance Capacitor/SQLite. */
export function peekStorageString(key, fallback = "") {
  assertAllowedKey(key);
  if (typeof localStorage === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
