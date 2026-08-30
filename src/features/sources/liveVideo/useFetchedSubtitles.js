import { useEffect, useState } from "react";
import { fetchAnimeStreamPayload } from "../../../lib/hls/sourceStreamLoader";
import { parseVtt } from "./parseVtt";

const RETRY_MS = 4000;
const MAX_RETRIES = 45;

export function useFetchedSubtitles(subtitleTracks = [], enabled = true) {
  const [cues, setCues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const track = subtitleTracks.find((entry) => entry?.url);
    if (!enabled || !track?.url) {
      setCues([]);
      setLoading(false);
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = 0;
    let attempts = 0;

    async function load() {
      if (cancelled) return;
      setLoading(true);
      try {
        const { data } = await fetchAnimeStreamPayload(track.url, "text");
        if (cancelled) return;
        const text = String(data || "").trim();
        if (!text.startsWith("WEBVTT")) {
          throw new Error("VTT indisponible");
        }
        const parsed = parseVtt(text);
        if (!parsed.length) {
          throw new Error("VTT vide");
        }
        setCues(parsed);
        setReady(true);
        setLoading(false);
      } catch {
        if (cancelled) return;
        attempts += 1;
        if (attempts >= MAX_RETRIES) {
          setCues([]);
          setReady(false);
          setLoading(false);
          return;
        }
        retryTimer = window.setTimeout(load, RETRY_MS);
      }
    }

    setCues([]);
    setReady(false);
    load();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [enabled, subtitleTracks]);

  return { cues, loading, ready };
}
