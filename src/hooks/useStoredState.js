import { usePersistedState } from "./usePersistedState";

/** @deprecated Utiliser usePersistedState */
export function useStoredState(key, fallback) {
  return usePersistedState(key, fallback);
}
