import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getChapterProgress } from "../../../lib/storage/chapterProgress";
import { findDriveEmbedSourceIndex, isDriveMkvStreamSource, sortPlaybackSources } from "../../../lib/hls/playbackQuality";
import { isAllowedEmbedUrl } from "../../../lib/video/embedHosts";
import { fetchSourceChapter, fetchSourceDetails, formatSourceError, peekSourceChapter, peekSourceDetails } from "../sourceApi";
import { buildSubtitleTracks, resolveLivePlayback } from "./resolveLivePlayback";
import { findNextPlaybackSourceIndex } from "./playbackFallback";
import { resolveActiveSourceIndex, resolveCachedPlaybackData } from "./videoPlaybackCache";

function readChapterBootstrap(sourceId, chapter, manga, prefetchData) {
  return resolveCachedPlaybackData({
    prefetchData,
    cached: peekSourceChapter(sourceId, chapter.url, {
      contentApi: chapter.contentApi,
      language: chapter.preferredAudioLanguage || manga.preferredAudioLanguage || "",
    }),
    chapterUrl: chapter.url,
  });
}

export function useVideoChapterSession({
  manga,
  chapter,
  sourceId,
  presentation,
  pushToast,
  t,
  onChapterLoadStart,
  preferredSourceIndex,
  prefetchData,
}) {
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(
    (Array.isArray(manga.chapters) && manga.chapters.length ? manga.chapters : manga.recentChapters) || [chapter],
  );
  const [data, setData] = useState(() => readChapterBootstrap(sourceId, chapter, manga, prefetchData));
  const [error, setError] = useState("");
  const [activeSourceIndex, setActiveSourceIndex] = useState(() => resolveActiveSourceIndex({
    data: readChapterBootstrap(sourceId, chapter, manga, prefetchData),
    preferredSourceIndex,
    preferDriveEmbed: Capacitor.isNativePlatform(),
    applyPreferred: Number.isInteger(preferredSourceIndex),
  }));
  const [hlsRetryKey, setHlsRetryKey] = useState(0);
  const [embedFallbackIndexes, setEmbedFallbackIndexes] = useState(() => new Set());

  const orderedSources = useMemo(
    () => sortPlaybackSources(data?.sources?.length ? data.sources : []),
    [data?.sources],
  );

  const currentSource = useMemo(() => {
    const source = orderedSources[activeSourceIndex] ?? orderedSources[0] ?? null;
    if (!source || !embedFallbackIndexes.has(activeSourceIndex)) return source;
    const { streamUrl, streamReferer, streamType, ...rest } = source;
    return rest;
  }, [activeSourceIndex, embedFallbackIndexes, orderedSources]);

  const orderedSourcesRef = useRef(orderedSources);
  const activeSourceIndexRef = useRef(activeSourceIndex);
  const embedFallbackIndexesRef = useRef(embedFallbackIndexes);
  orderedSourcesRef.current = orderedSources;
  activeSourceIndexRef.current = activeSourceIndex;
  embedFallbackIndexesRef.current = embedFallbackIndexes;

  const preferDriveEmbed = useMemo(() => {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 900px)").matches;
  }, []);

  const handleHlsError = useCallback(() => {
    const sources = orderedSourcesRef.current;
    const index = activeSourceIndexRef.current;
    const current = sources[index];

    if (isDriveMkvStreamSource(current)) {
      const embedIndex = findDriveEmbedSourceIndex(sources);
      if (embedIndex >= 0 && embedIndex !== index) {
        pushToast({ type: "info", message: t("reader.stream.switchingServer") });
        setActiveSourceIndex(embedIndex);
        setHlsRetryKey((value) => value + 1);
        return;
      }
    }

    if (current?.streamUrl && current?.url && !embedFallbackIndexesRef.current.has(index)) {
      pushToast({ type: "info", message: t("reader.stream.switchingServer") });
      setEmbedFallbackIndexes((value) => new Set(value).add(index));
      setHlsRetryKey((value) => value + 1);
      return;
    }

    const nextIndex = findNextPlaybackSourceIndex(sources, index);
    if (nextIndex >= 0) {
      pushToast({ type: "info", message: t("reader.stream.switchingServer") });
      setActiveSourceIndex(nextIndex);
      setHlsRetryKey((value) => value + 1);
      return;
    }

    pushToast({ type: "error", message: t("reader.stream.playFailed") });
  }, [pushToast, t]);

  const playback = useMemo(
    () => resolveLivePlayback({
      data,
      currentSource,
      sourceId,
      activeChapterUrl: activeChapter.url,
    }),
    [activeChapter.url, currentSource, data, sourceId],
  );

  useEffect(() => {
    if (!playback || playback.mode !== "embed" || !playback.url) return;
    if (isAllowedEmbedUrl(playback.url)) return;
    handleHlsError();
  }, [handleHlsError, hlsRetryKey, playback]);

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
    const seed = Array.isArray(manga.chapters) && manga.chapters.length
      ? manga.chapters
      : manga.recentChapters;
    if (seed?.length) setChapters(seed);

    const cached = peekSourceDetails(sourceId, manga.url, manga);
    if (cached?.chapters?.length) {
      setChapters(cached.chapters);
      return () => { active = false; };
    }
    if (Array.isArray(seed) && seed.length > 1) {
      return () => { active = false; };
    }

    fetchSourceDetails(sourceId, manga.url, manga).then((details) => {
      if (active && details.chapters?.length) setChapters(details.chapters);
    }).catch(() => {});
    return () => { active = false; };
  }, [manga.url, sourceId]);

  useEffect(() => {
    let active = true;
    const chapterOpts = {
      contentApi: activeChapter.contentApi,
      language: activeChapter.preferredAudioLanguage || manga.preferredAudioLanguage || "",
    };
    const bootstrap = resolveCachedPlaybackData({
      prefetchData,
      cached: peekSourceChapter(sourceId, activeChapter.url, chapterOpts),
      chapterUrl: activeChapter.url,
    });

    setError("");
    setHlsRetryKey(0);
    setEmbedFallbackIndexes(new Set());
    onChapterLoadStart?.();

    const applyResult = (result) => {
      setData(result);
      setActiveSourceIndex(resolveActiveSourceIndex({
        data: result,
        preferredSourceIndex,
        preferDriveEmbed,
        applyPreferred: Number.isInteger(preferredSourceIndex) && activeChapter.url === chapter.url,
      }));
    };

    if (bootstrap) {
      applyResult(bootstrap);
      return () => { active = false; };
    }

    setData(null);
    setActiveSourceIndex(0);
    fetchSourceChapter(sourceId, activeChapter.url, chapterOpts)
      .then((result) => {
        if (!active) return;
        applyResult(result);
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
    preferDriveEmbed,
    preferredSourceIndex,
    prefetchData,
    sourceId,
    chapter.url,
  ]);

  const selectSource = useCallback((index) => {
    setActiveSourceIndex(index);
    setEmbedFallbackIndexes(new Set());
    setHlsRetryKey((value) => value + 1);
  }, []);

  const changeChapter = useCallback((nextChapter) => {
    if (!nextChapter) return;
    setActiveChapter(nextChapter);
  }, []);

  const initialProgress = useMemo(
    () => Math.min(100, Math.max(0, Number(getChapterProgress(sourceId, activeChapter.url)) || 0)),
    [activeChapter.url, sourceId],
  );

  return {
    activeChapter,
    chapters,
    data,
    error,
    activeSourceIndex,
    hlsRetryKey,
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
