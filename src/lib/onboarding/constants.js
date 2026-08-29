import { isChromebookApp } from "../../config/appFlavor.js";
import { peekStorageString } from "../storage/peek.js";
import { STORAGE_META_MIGRATED } from "../storage/constants.js";

export const ONBOARDING_COMPLETE_KEY = "living-archive:onboarding-complete";

export function peekOnboardingComplete() {
  try {
    const raw = peekStorageString(ONBOARDING_COMPLETE_KEY, "");
    if (!raw) return false;
    if (raw === "true") return true;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function isExistingAppUser() {
  if (peekOnboardingComplete()) return true;

  if (peekStorageString(STORAGE_META_MIGRATED, "") === "true") {
    return true;
  }

  try {
    const favorites = JSON.parse(peekStorageString("mangashelf:favorites", "[]"));
    if (Array.isArray(favorites) && favorites.length > 0) return true;
  } catch {
    // Ignore malformed storage.
  }

  try {
    const history = JSON.parse(peekStorageString("living-archive:reading-history", "{}"));
    if (history && typeof history === "object" && Object.keys(history).length > 0) {
      return true;
    }
  } catch {
    // Ignore malformed storage.
  }

  return false;
}

export function shouldSkipOnboarding() {
  return isChromebookApp || peekOnboardingComplete() || isExistingAppUser();
}
