import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChapterProgress } from "../../../lib/storage/chapterProgress";
import { pickBestPlaybackSourceIndex, sortPlaybackSources } from "../../../lib/hls/playbackQuality";
import { fetchSourceChapter, fetchSourceDetails, formatSourceError } from "../sourceApi";
import { buildSubtitleTracks, resolveLivePlayback } from "./resolveLivePlayback";

export function useVideoChapterSession({
  manga,
  chapter,
  sourceId,
  presentation,
  pushToast,
  t,
  onChapterLoadStart,
}) {
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(manga.recentChapters || [chapter]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [hlsRetryKey, setHlsRetryKey] = useState(0);
  const [preferEmbedPlayback, setPreferEmbedPlayback] = useState(false);

  const orderedSources = useMemo(
    () => sortPlaybackSources(data?.sources?.length ? data.sources : []),
    [data?.sources],
  );

  const currentSource = orderedSources[activeSourceIndex] ?? orderedSources[0] ?? null;

  const orderedSourcesRef = useRef(orderedSources);
  const activeSourceIndexRef = useRef(activeSourceIndex);
  orderedSourcesRef.current = orderedSources;
  activeSourceIndexRef.current = activeSourceIndex;

  const preferEmbedRef = useRef(preferEmbedPlayback);
  preferEmbedRef.current = preferEmbedPlayback;

  const handleHlsError = useCallback(() => {
    const sources = orderedSourcesRef.current;
    const index = activeSourceIndexRef.current;
    const current = sources[index];

    if (current?.streamUrl && current?.url && !preferEmbedRef.current) {
      pushToast({ type: "info", message: t("reader.stream.embedFallback") });
      setPreferEmbedPlayback(true);
      setHlsRetryKey((value) => value + 1);
      return;
    }

    if (index + 1 < sources.length) {
      pushToast({ type: "info", message: t("reader.stream.switchingServer") });
      setPreferEmbedPlayback(false);
      setActiveSourceIndex(index + 1);
      setHlsRetryKey((value) => value + 1);
      return;
    }

    if (current?.url && !preferEmbedRef.current) {
      pushToast({ type: "info", message: t("reader.stream.embedFallback") });
      setPreferEmbedPlayback(true);
      setHlsRetryKey((value) => value + 1);
      return;
    }

    pushToast({ type: "error", message: t("reader.stream.playFailed") });
  }, [pushToast, t]);

  const playback = useMemo(
    () => resolveLivePlayback({
      data,
      currentSource,
      preferEmbedPlayback,
      sourceId,
      activeChapterUrl: activeChapter.url,
    }),
    [activeChapter.url, currentSource, data, preferEmbedPlayback, sourceId],
  );

  const embedMode = playback?.mode === "embed";
  const usePlyrPlayer = playback?.mode === "hls";

  const subtitleTracks = useMemo(
    () => buildSubtitleTracks({
      data,
      currentSource,
      embedMode,
      sourceId,
      activeChapterUrl: activeChapter.url,
    }),
    [activeChapter.url, currentSource, data, embedMode, sourceId],
  );

  useEffect(() => {
    let active = true;
    fetchSourceDetails(sourceId, manga.url).then((details) => {
      if (active && details.chapters?.length) setChapters(details.chapters);
    }).catch(() => {});
    return () => { active = false; };
  }, [manga.url, sourceId]);

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setActiveSourceIndex(0);
    setHlsRetryKey(0);
    setPreferEmbedPlayback(false);
    onChapterLoadStart?.();

    fetchSourceChapter(sourceId, activeChapter.url, {
      contentApi: activeChapter.contentApi,
      language: activeChapter.preferredAudioLanguage || manga.preferredAudioLanguage || "",
    })
      .then((result) => {
        if (!active) return;
        setData(result);
        setActiveSourceIndex(pickBestPlaybackSourceIndex(sortPlaybackSources(result.sources)));
      })
      .catch((reason) => {
        if (!active) return;
        const message = formatSourceError(reason, presentation.loadError);
        setError(message);
        pushToast({ type: "error", message });
      });
    return () => { active = false; };
  }, [
    activeChapter.url,
    activeChapter.preferredAudioLanguage,
    activeChapter.contentApi,
    manga.preferredAudioLanguage,
    onChapterLoadStart,
    presentation.loadError,
    pushToast,
    sourceId,
  ]);

  const selectSource = useCallback((index) => {
    setActiveSourceIndex(index);
    setPreferEmbedPlayback(false);
    setHlsRetryKey((value) => value + 1);
  }, []);

  const changeChapter = useCallback((nextChapter) => {
    if (!nextChapter) return;
    setActiveChapter(nextChapter);
  }, []);

  const initialProgress = useMemo(
    () => {
      const saved = getChapterProgress(sourceId, activeChapter.url);
      return saved > 0 && saved < 100 ? saved : 0;
    },
    [activeChapter.url, sourceId],
  );

  return {
    activeChapter,
    chapters,
    data,
    error,
    activeSourceIndex,
    hlsRetryKey,
    preferEmbedPlayback,
    orderedSources,
    currentSource,
    playback,
    embedMode,
    usePlyrPlayer,
    subtitleTracks,
    handleHlsError,
    selectSource,
    changeChapter,
    initialProgress,
  };
}
