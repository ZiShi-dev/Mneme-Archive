import { useEffect, useRef, useState } from "react";
import { useStorage } from "../components/storage/StorageProvider";
import { kvGet, kvGetSync, kvHasSync, kvSet } from "../lib/storage/initStorage";

export function usePersistedState(key, fallback) {
  const { ready } = useStorage();
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState(() => (kvHasSync(key) ? kvGetSync(key, fallback) : fallback));
  const [hydrated, setHydrated] = useState(() => kvHasSync(key));

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    if (!ready || hydrated) return;
    let active = true;
    kvGet(key, fallbackRef.current).then((stored) => {
      if (!active) return;
      setValue(stored);
      setHydrated(true);
    });
    return () => { active = false; };
  }, [key, ready, hydrated]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    void kvSet(key, value);
  }, [key, value, ready, hydrated]);

  return [value, setValue];
}
