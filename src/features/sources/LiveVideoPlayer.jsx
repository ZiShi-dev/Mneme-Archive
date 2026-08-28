import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, Bookmark, Check, ChevronRight, Clapperboard, ExternalLink, Play, RefreshCw, RotateCcw, RotateCw, Wifi } from "lucide-react";
import { burstSakuraFrom } from "../../lib/sakura/burst";
import { lockLandscapeOrientation, unlockOrientation } from "../../lib/video/orientationLock";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { getChapterProgress, setChapterProgress } from "../../lib/storage/chapterProgress";
import { fetchSourceChapter, fetchSourceDetails, formatSourceError, sourceStreamUrl, sourceSubtitleUrl } from "./sourceApi";
import { ReaderHeader } from "./ReaderHeader";
import { VideoPlaybackControls } from "./VideoPlaybackControls";
import { PlyrHlsPlayer } from "./PlyrHlsPlayer";
import { EmbedPlayerFrame } from "./EmbedPlayerFrame";
import { getItemType } from "./contentTypes";
import { installEmbedPopupGuards } from "../../lib/video/embedHosts";
import { getMediaPresentation, resolveVideoPlayback, formatEpisodeHeaderLabel } from "./mediaPresentation";
import { isChromebookApp } from "../../config/appFlavor";
import { scrollAppToTop } from "../../lib/platform/scrollRoot";
import { useI18n } from "../../i18n/I18nProvider";
import { ThemedScrollbar } from "../../components/layout/ThemedScrollbar";
import { pickBestPlaybackSourceIndex, sortPlaybackSources } from "../../lib/hls/playbackQuality";

const VIDEO_COMPLETE_THRESHOLD = 92;
const EMBED_TICK_MS = 15000;
const EMBED_SECONDS_PER_PERCENT = 45;
const EMBED_PROGRESS_CAP = 91;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 10;
const CHROME_IDLE_MS = 3200;
const FULLSCREEN_CHROME_IDLE_MS = 2000;
const DOUBLE_TAP_MS = 320;
const SINGLE_TAP_DELAY_MS = 280;
const SKIP_ZONE_RATIO = 0.38;

function formatServerLabel(source = {}, translate) {
  const label = String(source.label || "").trim();
  if (/^anime4up[12]$/i.test(label)) return translate("reader.stream.serverN", { n: label.replace(/anime4up/i, "") });
  return label || translate("reader.stream.server");
}

function sortSourcesByPlaybackQuality(sources = []) {
  return sortPlaybackSources(sources);
}

function pickBestSourceIndex(sources = []) {
  return pickBestPlaybackSourceIndex(sources);
}

export function LiveVideoPlayer({
  manga,
  chapter,
  onBack,
  onOpenDetails,
  isFavorite,
  onToggleFavorite,
  onSaveProgress,
}) {
  const { pushToast } = useToast();
  const { t, dir } = useI18n();
  const sourceId = resolveSourceId(manga);
  const profile = getSourceProfile(sourceId);
  const presentation = getMediaPresentation(getItemType(manga));
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(manga.recentChapters || [chapter]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [hlsRetryKey, setHlsRetryKey] = useState(0);
  const [preferEmbedPlayback, setPreferEmbedPlayback] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [phoneLandscape, setPhoneLandscape] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [skipFlash, setSkipFlash] = useState(null);
  const videoRef = useRef(null);
  const [plyrInstance, setPlyrInstance] = useState(null);
  const plyrInstanceRef = useRef(null);
  const embedRef = useRef(null);
  const fullscreenRootRef = useRef(null);
  const chromeHideTimerRef = useRef(0);
  const chromeInteractingRef = useRef(false);
  const singleTapTimerRef = useRef(0);
  const skipFlashTimerRef = useRef(0);
  const tapStateRef = useRef({ time: 0, x: 0 });
  const completedRef = useRef(false);
  const playErrorAtRef = useRef(0);

  const orderedSources = useMemo(
    () => sortSourcesByPlaybackQuality(data?.sources?.length ? data.sources : []),
    [data?.sources],
  );

  const currentSource = orderedSources[activeSourceIndex] ?? orderedSources[0] ?? null;

  const orderedSourcesRef = useRef(orderedSources);
  const activeSourceIndexRef = useRef(activeSourceIndex);
  orderedSourcesRef.current = orderedSources;
  activeSourceIndexRef.current = activeSourceIndex;

  const handleHlsError = useCallback(() => {
    const sources = orderedSourcesRef.current;
    const index = activeSourceIndexRef.current;
    const current = sources[index];

    if (current?.streamUrl && current?.url && !preferEmbedPlayback) {
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

    if (current?.url && !preferEmbedPlayback) {
      pushToast({ type: "info", message: t("reader.stream.embedFallback") });
      setPreferEmbedPlayback(true);
      setHlsRetryKey((value) => value + 1);
      return;
    }

    pushToast({
      type: "error",
      message: t("reader.stream.playFailed"),
    });
  }, [preferEmbedPlayback, pushToast, t]);

  const handleHlsReady = useCallback((video) => {
    setDuration(video.duration || 0);
  }, []);

  const bindImmersiveRoot = useCallback((node) => {
    fullscreenRootRef.current = node;
  }, []);

  const mangaRef = useRef(manga);
  const chapterRef = useRef(activeChapter);
  const saveProgressRef = useRef(onSaveProgress);
  mangaRef.current = manga;
  chapterRef.current = activeChapter;
  saveProgressRef.current = onSaveProgress;

  const playback = useMemo(() => {
    if (!data) return null;

    if (currentSource?.streamUrl && !preferEmbedPlayback) {
      const referer = currentSource.streamReferer || data.streamReferer || data.url || activeChapter.url;
      return {
        mode: "hls",
        url: sourceStreamUrl(sourceId, currentSource.streamUrl, referer),
        referer,
      };
    }

    if (currentSource?.url) {
      return { mode: "embed", url: currentSource.url };
    }

    const resolved = resolveVideoPlayback(data);
    if (resolved?.mode === "hls" && (data.streamUrl || data.videoUrl || resolved.url)) {
      const streamUrl = data.streamUrl || data.videoUrl || resolved.url;
      const referer = data.streamReferer || data.url || activeChapter.url;
      return {
        mode: "hls",
        url: sourceStreamUrl(sourceId, streamUrl, referer),
        referer,
      };
    }

    if (data.embedUrl || resolved?.mode === "embed") {
      return { mode: "embed", url: data.embedUrl || resolved.url };
    }

    return resolved;
  }, [activeChapter.url, currentSource, data, preferEmbedPlayback, sourceId]);

  const embedMode = playback?.mode === "embed";
  const usePlyrPlayer = playback?.mode === "hls";
  const plyrFullscreenActive = Boolean(plyrInstance?.fullscreen?.active);
  const cinemaMode = Boolean(
    playback
    && (immersiveMode || isFullscreen || plyrFullscreenActive),
  );
  const cssFullscreen = cinemaMode && !nativeFullscreen;

  const syncCinemaDom = useCallback((active) => {
    const root = fullscreenRootRef.current;
    if (!root) return;
    if (active) root.classList.add("plyr--fullscreen-fallback");
    else root.classList.remove("plyr--fullscreen-fallback", "plyr--fullscreen-active");
  }, []);

  const activateCinemaMode = useCallback(() => {
    setChromeVisible(true);
    setImmersiveMode(true);
    setIsFullscreen(true);
    syncCinemaDom(true);
  }, [syncCinemaDom]);

  useEffect(() => {
    if (!plyrInstance) return undefined;
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const onEnter = () => {
      const nativeActive = Boolean(getFullscreenElement());
      setChromeVisible(true);
      setImmersiveMode(true);
      setIsFullscreen(true);
      setNativeFullscreen(nativeActive);
      if (!nativeActive) syncCinemaDom(true);
    };
    const onExit = () => {
      setImmersiveMode(false);
      setIsFullscreen(false);
      setNativeFullscreen(false);
      syncCinemaDom(false);
    };
    plyrInstance.on("enterfullscreen", onEnter);
    plyrInstance.on("exitfullscreen", onExit);
    return () => {
      plyrInstance.off("enterfullscreen", onEnter);
      plyrInstance.off("exitfullscreen", onExit);
    };
  }, [plyrInstance, syncCinemaDom]);

  useEffect(() => {
    if (!isChromebookApp) return undefined;
    const root = document.documentElement;
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const syncCinemaClass = () => {
      const nativeActive = Boolean(getFullscreenElement());
      const cssCinema = cinemaMode && !nativeActive;
      if (cssCinema) root.classList.add("video-cinema-active");
      else root.classList.remove("video-cinema-active");
    };
    syncCinemaClass();
    document.addEventListener("fullscreenchange", syncCinemaClass);
    document.addEventListener("webkitfullscreenchange", syncCinemaClass);
    return () => {
      document.removeEventListener("fullscreenchange", syncCinemaClass);
      document.removeEventListener("webkitfullscreenchange", syncCinemaClass);
      root.classList.remove("video-cinema-active");
    };
  }, [cinemaMode]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isChromebookApp) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { StatusBar } = await import("@capacitor/status-bar");
        if (cancelled) return;
        if (cinemaMode) await StatusBar.hide();
        else await StatusBar.show();
      } catch {
        // Plugin optionnel selon la plateforme.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cinemaMode]);

  useEffect(() => {
    if (!embedMode || !Capacitor.isNativePlatform()) return undefined;
    return installEmbedPopupGuards();
  }, [embedMode]);

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimerRef.current) {
      window.clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = 0;
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer();
    if (chromeInteractingRef.current || embedMode) return;
    const immersivePlayback = cinemaMode;
    if (!immersivePlayback && !playing) return;

    const idleMs = immersivePlayback ? FULLSCREEN_CHROME_IDLE_MS : CHROME_IDLE_MS;
    chromeHideTimerRef.current = window.setTimeout(() => {
      if (!chromeInteractingRef.current && (playing || immersivePlayback)) {
        setChromeVisible(false);
      }
    }, idleMs);
  }, [cinemaMode, clearChromeHideTimer, embedMode, playing]);

  const revealChrome = useCallback((options = {}) => {
    const { autoHide = true } = options;
    setChromeVisible(true);
    clearChromeHideTimer();
    if (autoHide) scheduleChromeHide();
  }, [clearChromeHideTimer, scheduleChromeHide]);

  const hideChrome = useCallback(() => {
    clearChromeHideTimer();
    setChromeVisible(false);
  }, [clearChromeHideTimer]);

  useEffect(() => {
    if (!playback || embedMode) return undefined;
    if (!playing && !cinemaMode) {
      clearChromeHideTimer();
      setChromeVisible(true);
      return undefined;
    }
    if (chromeVisible) scheduleChromeHide();
    return clearChromeHideTimer;
  }, [chromeVisible, cinemaMode, clearChromeHideTimer, embedMode, playback, playing, scheduleChromeHide]);

  useEffect(() => {
    if (!cinemaMode || embedMode) return undefined;
    revealChrome({ autoHide: true });
    return undefined;
  }, [cinemaMode, embedMode, revealChrome]);

  useEffect(() => {
    if (!cinemaMode || !usePlyrPlayer) return undefined;
    const root = fullscreenRootRef.current;
    if (!root) return undefined;

    const onPointerOver = (event) => {
      if (!event.target.closest(".plyr__controls, .plyr__menu")) return;
      chromeInteractingRef.current = true;
      clearChromeHideTimer();
      setChromeVisible(true);
    };
    const onPointerOut = (event) => {
      if (!event.target.closest(".plyr__controls, .plyr__menu")) return;
      chromeInteractingRef.current = false;
      scheduleChromeHide();
    };

    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    return () => {
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
    };
  }, [cinemaMode, clearChromeHideTimer, plyrInstance, scheduleChromeHide, usePlyrPlayer]);

  useEffect(() => () => {
    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    if (skipFlashTimerRef.current) window.clearTimeout(skipFlashTimerRef.current);
    unlockOrientation();
  }, []);

  useEffect(() => {
    if (!playback || embedMode || (!immersiveMode && !isFullscreen)) {
      unlockOrientation();
      return undefined;
    }

    lockLandscapeOrientation().catch(() => {});
    return () => unlockOrientation();
  }, [embedMode, immersiveMode, isFullscreen, playback]);

  const subtitleTracks = useMemo(() => {
    if (!data || embedMode) return [];
    const referer = currentSource?.streamReferer || data.streamReferer || data.url || activeChapter.url;
    const tracks = currentSource?.subtitleTracks?.length
      ? currentSource.subtitleTracks
      : (data.subtitleTracks || []);
    return tracks.map((track) => ({
      ...track,
      url: sourceSubtitleUrl(sourceId, track.url, referer),
    }));
  }, [activeChapter.url, currentSource, data, embedMode, sourceId]);

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
    setPlaying(false);
    setBuffered(0);
    setSubtitlesEnabled(true);
    setChromeVisible(true);
    setImmersiveMode(false);
    clearChromeHideTimer();
    completedRef.current = false;
    const saved = getChapterProgress(sourceId, activeChapter.url);
    setProgress(saved > 0 && saved < 100 ? saved : 0);
    setCurrentTime(0);
    setDuration(0);

    fetchSourceChapter(sourceId, activeChapter.url, {
      contentApi: activeChapter.contentApi,
      language: activeChapter.preferredAudioLanguage || manga.preferredAudioLanguage || "",
    })
      .then((result) => {
        if (!active) return;
        setData(result);
        setActiveSourceIndex(pickBestSourceIndex(sortSourcesByPlaybackQuality(result.sources)));
      })
      .catch((reason) => {
        if (!active) return;
        const message = formatSourceError(reason, presentation.loadError);
        setError(message);
        pushToast({ type: "error", message });
      });
    return () => { active = false; };
  }, [activeChapter.url, activeChapter.preferredAudioLanguage, activeChapter.contentApi, clearChromeHideTimer, manga.preferredAudioLanguage, presentation.loadError, pushToast, sourceId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || playback.mode === "embed") return undefined;

    const saved = getChapterProgress(sourceId, activeChapter.url);
    const applySavedPosition = () => {
      if (!video.duration || saved <= 0 || saved >= 100) return;
      video.currentTime = (saved / 100) * video.duration;
      setCurrentTime(video.currentTime);
      setProgress(saved);
    };

    video.addEventListener("loadedmetadata", applySavedPosition);
    if (video.readyState >= 1) applySavedPosition();
    return () => video.removeEventListener("loadedmetadata", applySavedPosition);
  }, [activeChapter.url, playback?.mode, playback?.url, sourceId]);

  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setProgress(100);
    setChapterProgress(sourceId, activeChapter.url, 100);
    onSaveProgress?.(manga, activeChapter, 100, { completed: true });
    pushToast({ type: "success", message: presentation.completeToast });
  }, [activeChapter, manga, onSaveProgress, presentation.completeToast, pushToast, sourceId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || playback.mode === "embed") return undefined;

    const onTimeUpdate = () => {
      const nextDuration = video.duration || 0;
      const nextTime = video.currentTime || 0;
      const nextProgress = nextDuration > 0 ? Math.round((nextTime / nextDuration) * 100) : 0;
      setDuration(nextDuration);
      setCurrentTime(nextTime);
      setProgress(nextProgress);
      setChapterProgress(sourceId, activeChapter.url, nextProgress);
      if (onSaveProgress && nextProgress > 0 && !completedRef.current) {
        onSaveProgress(manga, activeChapter, nextProgress, { completed: false });
      }
      if (nextProgress >= VIDEO_COMPLETE_THRESHOLD && !completedRef.current) {
        markComplete();
      }
    };

    const onEnded = () => {
      setPlaying(false);
      markComplete();
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onProgress = () => {
      if (!video.duration || !video.buffered.length) {
        setBuffered(0);
        return;
      }
      const end = video.buffered.end(video.buffered.length - 1);
      setBuffered(Math.round((end / video.duration) * 100));
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onProgress);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    if (video.readyState >= 1) onProgress();
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [activeChapter, manga, markComplete, onSaveProgress, playback?.mode, playback?.url, sourceId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playback?.mode === "embed") return;
    video.playbackRate = playbackRate;
  }, [playback?.mode, playback?.url, playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playback?.mode === "embed") return;
    video.volume = volume;
    video.muted = muted;
  }, [muted, playback?.mode, playback?.url, volume]);

  useEffect(() => {
    const syncOrientation = () => {
      const landscape = window.matchMedia("(orientation: landscape)").matches
        && window.innerHeight <= 520;
      setPhoneLandscape(landscape);
    };

    syncOrientation();
    window.addEventListener("resize", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);
    return () => {
      window.removeEventListener("resize", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
    };
  }, []);

  useEffect(() => {
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    const onFullscreenChange = () => {
      const root = fullscreenRootRef.current;
      const nativeActive = Boolean(root && getFullscreenElement() === root);
      const fallbackActive = Boolean(
        root?.classList.contains("plyr--fullscreen-fallback")
        || root?.querySelector(".plyr--fullscreen-fallback, .plyr--fullscreen-active"),
      );
      const active = nativeActive || fallbackActive;
      setNativeFullscreen(nativeActive);
      setIsFullscreen(active);
      if (nativeActive) syncCinemaDom(false);
      if (!active && !plyrInstanceRef.current?.fullscreen?.active) setImmersiveMode(false);
      else setImmersiveMode(true);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [syncCinemaDom]);

  const pipSupported = typeof document !== "undefined"
    && document.pictureInPictureEnabled !== false
    && typeof HTMLVideoElement !== "undefined"
    && typeof HTMLVideoElement.prototype.requestPictureInPicture === "function";

  useEffect(() => {
    if (!playback) return undefined;

    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (embedMode && event.key !== "f" && event.key !== "F") return;
      const video = videoRef.current;
      if (!embedMode && !video) return;
      if (!embedMode) revealChrome();

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          if (embedMode) return;
          event.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "ArrowLeft":
        case "j":
        case "J":
          if (embedMode) return;
          event.preventDefault();
          if (video.duration) {
            video.currentTime = Math.max(0, video.currentTime - (event.shiftKey ? 30 : SKIP_SECONDS));
          }
          break;
        case "ArrowRight":
        case "l":
        case "L":
          if (embedMode) return;
          event.preventDefault();
          if (video.duration) {
            video.currentTime = Math.min(video.duration, video.currentTime + (event.shiftKey ? 30 : SKIP_SECONDS));
          }
          break;
        case "ArrowUp":
          if (embedMode) return;
          event.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          video.muted = false;
          setVolume(video.volume);
          setMuted(false);
          break;
        case "ArrowDown":
          if (embedMode) return;
          event.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          video.muted = video.volume === 0;
          setVolume(video.volume);
          setMuted(video.muted);
          break;
        case "m":
        case "M":
          if (embedMode) return;
          event.preventDefault();
          video.muted = !video.muted;
          setMuted(video.muted);
          break;
        case "f":
        case "F":
          event.preventDefault();
          requestFullscreen();
          break;
        case "p":
        case "P":
          if (embedMode || !pipSupported) return;
          event.preventDefault();
          if (document.pictureInPictureElement) document.exitPictureInPicture?.();
          else video.requestPictureInPicture?.().catch(() => {});
          break;
        case "<":
        case ",":
          if (embedMode) return;
          event.preventDefault();
          setPlaybackRate((current) => {
            const index = PLAYBACK_SPEEDS.indexOf(current);
            return PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length];
          });
          break;
        case "c":
        case "C":
          if (embedMode) return;
          event.preventDefault();
          setSubtitlesEnabled((value) => !value);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedMode, pipSupported, playback, revealChrome]);

  useEffect(() => {
    if (!embedMode || !playback?.url || !data || error) return undefined;
    const chapterUrl = activeChapter.url;
    const saved = getChapterProgress(sourceId, chapterUrl);
    if (saved >= VIDEO_COMPLETE_THRESHOLD) {
      completedRef.current = true;
      setProgress(100);
      return undefined;
    }

    let visibleSeconds = 0;
    let lastTick = Date.now();
    let latestProgress = Math.max(saved, 1);

    const persist = (nextProgress) => {
      if (completedRef.current) return;
      const clamped = Math.min(EMBED_PROGRESS_CAP, Math.max(latestProgress, nextProgress));
      latestProgress = clamped;
      setProgress(clamped);
      setChapterProgress(sourceId, chapterUrl, clamped);
      saveProgressRef.current?.(mangaRef.current, chapterRef.current, clamped, { completed: false });
    };

    persist(latestProgress);

    const tick = () => {
      if (document.visibilityState !== "visible") {
        lastTick = Date.now();
        return;
      }
      const now = Date.now();
      visibleSeconds += (now - lastTick) / 1000;
      lastTick = now;
      persist(Math.max(saved, 1) + Math.floor(visibleSeconds / EMBED_SECONDS_PER_PERCENT));
    };

    const interval = window.setInterval(tick, EMBED_TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") tick();
      else lastTick = Date.now();
    };
    window.addEventListener("pagehide", tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      tick();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeChapter.url, data, embedMode, error, playback?.url, sourceId]);

  const currentIndex = useMemo(
    () => chapters.findIndex((entry) => entry.url === activeChapter.url || (entry.number && String(entry.number) === String(activeChapter.number))),
    [activeChapter, chapters],
  );
  const previousChapter = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const nextChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;

  const showEpisodePlaylist = isChromebookApp && presentation.type === "series" && chapters.length > 1;
  const playlistChapters = useMemo(() => (
    [...chapters].sort((left, right) => {
      const leftNumber = Number(String(left.number || "").replace(/[^\d.]/g, ""));
      const rightNumber = Number(String(right.number || "").replace(/[^\d.]/g, ""));
      if (leftNumber && rightNumber && leftNumber !== rightNumber) return leftNumber - rightNumber;
      return String(left.name || left.number || "").localeCompare(String(right.name || right.number || ""), undefined, { numeric: true });
    })
  ), [chapters]);

  const activePlaylistItemRef = useRef(null);
  const playlistScrollerRef = useRef(null);

  useEffect(() => {
    scrollAppToTop();
    const rafId = window.requestAnimationFrame(() => scrollAppToTop());
    const timerId = window.setTimeout(() => scrollAppToTop(), 120);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      document.documentElement.classList.remove("video-cinema-active");
    };
  }, []);

  useEffect(() => {
    if (!showEpisodePlaylist) return;
    const scroller = playlistScrollerRef.current;
    const item = activePlaylistItemRef.current;
    if (!scroller || !item) return;
    const offset = item.offsetTop - (scroller.clientHeight - item.clientHeight) / 2;
    scroller.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }, [activeChapter.url, showEpisodePlaylist]);

  function seekToPercent(value) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const next = Math.round(Number(value));
    video.currentTime = (next / 100) * video.duration;
    setProgress(next);
    setCurrentTime(video.currentTime);
  }

  function skipBy(seconds) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const nextTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(Math.round((nextTime / video.duration) * 100));
  }

  function cyclePlaybackSpeed() {
    setPlaybackRate((current) => {
      const index = PLAYBACK_SPEEDS.indexOf(current);
      const next = PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length];
      pushToast({ type: "info", message: t("reader.stream.playbackSpeedToast", { speed: next }) });
      return next;
    });
  }

  function handleVolumeChange(nextVolume) {
    const video = videoRef.current;
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolume(clamped);
    setMuted(clamped === 0);
    if (video) {
      video.volume = clamped;
      video.muted = clamped === 0;
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    setMuted((current) => {
      const next = !current;
      if (video) video.muted = next;
      return next;
    });
  }

  async function requestPictureInPicture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      pushToast({ type: "error", message: t("reader.stream.pipFailed") });
    }
  }

  function showSkipFlash(direction) {
    setSkipFlash(direction);
    if (skipFlashTimerRef.current) window.clearTimeout(skipFlashTimerRef.current);
    skipFlashTimerRef.current = window.setTimeout(() => setSkipFlash(null), 750);
  }

  function performSingleTapAction() {
    if (!chromeVisible) {
      revealChrome({ autoHide: playing });
      return;
    }
    togglePlay();
    revealChrome();
  }

  function handleVideoSurfacePointerUp(event) {
    if (!playback) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".live-video-servers, .live-video-chrome, .reader-playback, .live-video-mark-complete, .live-video-embed-fullscreen, button, a, input, label")) {
      return;
    }

    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;

    const xRatio = (event.clientX - rect.left) / rect.width;
    const now = Date.now();
    const last = tapStateRef.current;

    if (embedMode) {
      if (now - last.time <= DOUBLE_TAP_MS && xRatio > SKIP_ZONE_RATIO && xRatio < 1 - SKIP_ZONE_RATIO) {
        tapStateRef.current = { time: 0, x: 0 };
        void requestFullscreen();
        return;
      }
      tapStateRef.current = { time: now, x: xRatio };
      return;
    }

    if (usePlyrPlayer) return;

    if (now - last.time <= DOUBLE_TAP_MS) {
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = 0;
      tapStateRef.current = { time: 0, x: 0 };

      if (xRatio < SKIP_ZONE_RATIO) {
        skipBy(-SKIP_SECONDS);
        showSkipFlash("back");
        revealChrome();
        return;
      }
      if (xRatio > 1 - SKIP_ZONE_RATIO) {
        skipBy(SKIP_SECONDS);
        showSkipFlash("forward");
        revealChrome();
        return;
      }
      togglePlay();
      revealChrome();
      return;
    }

    tapStateRef.current = { time: now, x: xRatio };
    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = 0;
      tapStateRef.current = { time: 0, x: 0 };
      performSingleTapAction();
    }, SINGLE_TAP_DELAY_MS);
  }

  function handleChromeInteractionStart() {
    chromeInteractingRef.current = true;
    clearChromeHideTimer();
    setChromeVisible(true);
  }

  function handleChromeInteractionEnd() {
    chromeInteractingRef.current = false;
    if (playing || cinemaMode) scheduleChromeHide();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.readyState < 2 && !video.duration) return;
      video.play().catch((reason) => {
        if (reason?.name === "NotAllowedError") return;
        const now = Date.now();
        if (now - playErrorAtRef.current < 2500) return;
        playErrorAtRef.current = now;
        pushToast({ type: "error", message: t("reader.stream.playVideoFailed") });
      });
    } else {
      video.pause();
    }
  }

  function changeChapter(nextChapterToOpen) {
    if (!nextChapterToOpen) return;
    setActiveChapter(nextChapterToOpen);
  }

  async function exitCinemaMode() {
    const plyr = plyrInstanceRef.current;
    if (plyr?.fullscreen?.active) {
      plyr.fullscreen.exit();
    }

    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const root = fullscreenRootRef.current;
    syncCinemaDom(false);

    if (root && getFullscreenElement() === root) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
    unlockOrientation();
    setImmersiveMode(false);
    setIsFullscreen(false);
    setNativeFullscreen(false);
  }

  async function requestNativeFullscreen() {
    const root = fullscreenRootRef.current;
    const plyr = plyrInstanceRef.current;
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    if (plyr?.fullscreen?.enabled) {
      plyr.fullscreen.enter();
      if (getFullscreenElement() || plyr.fullscreen?.active) return true;
    }

    if (!root) return false;

    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return Boolean(getFullscreenElement());
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
      return Boolean(getFullscreenElement());
    }

    const video = videoRef.current;
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    }

    return false;
  }

  async function requestFullscreen() {
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const root = fullscreenRootRef.current;
    const plyr = plyrInstanceRef.current;
    const fullscreenActive = Boolean(
      cinemaMode
      || getFullscreenElement()
      || immersiveMode
      || isFullscreen
      || plyr?.fullscreen?.active
      || root?.classList.contains("plyr--fullscreen-fallback"),
    );

    if (fullscreenActive) {
      await exitCinemaMode();
      return;
    }

    if (!root) return;

    setChromeVisible(true);
    setImmersiveMode(true);

    try {
      const ok = await requestNativeFullscreen();
      if (ok) {
        setIsFullscreen(true);
        setNativeFullscreen(Boolean(getFullscreenElement()));
        lockLandscapeOrientation().catch(() => {});
        return;
      }
    } catch {
      const video = videoRef.current;
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        lockLandscapeOrientation().catch(() => {});
        return;
      }
    }

    activateCinemaMode();
    lockLandscapeOrientation().catch(() => {});
  }

  const episodeLabel = formatEpisodeHeaderLabel(
    activeChapter.number || activeChapter.name,
    presentation.headerUnit,
  );

  const immersiveLock = immersiveMode && !isFullscreen;
  const watchDesktopLayout = isChromebookApp;

  const markCompleteAction = playback && progress < VIDEO_COMPLETE_THRESHOLD ? (
    <button
      type="button"
      className="live-video-mark-complete live-video-mark-complete--meta"
      onClick={markComplete}
    >
      <Check size={13} aria-hidden="true" />
      {presentation.type === "movie" ? t("reader.stream.markMovieComplete") : t("reader.stream.markEpisodeComplete")}
    </button>
  ) : null;

  const serverBar = orderedSources.length > 0 && data && !cinemaMode ? (
    <div
      className="live-video-servers live-video-servers--dock"
      aria-label={t("reader.stream.serversAria")}
    >
      {orderedSources.map((source, index) => (
        <button
          key={`${source.url}-${index}`}
          type="button"
          className={`live-video-servers__chip${index === activeSourceIndex ? " active" : ""}${source.streamUrl ? " live-video-servers__chip--native" : ""}`}
          onClick={() => {
            setActiveSourceIndex(index);
            setPreferEmbedPlayback(false);
            setHlsRetryKey((value) => value + 1);
          }}
          aria-pressed={index === activeSourceIndex}
        >
          {formatServerLabel(source, t)}
        </button>
      ))}
      {embedMode ? (
        <p className="live-video-servers__hint">{t("reader.stream.embedFallback")}</p>
      ) : null}
    </div>
  ) : null;

  const immersiveRoot = (
      <div
        ref={bindImmersiveRoot}
        className={`live-video-immersive-root${cinemaMode ? " is-cinema" : ""}${cssFullscreen ? " plyr--fullscreen-fallback" : ""}${chromeVisible ? " is-chrome-visible" : " is-chrome-hidden"}`}
        onPointerMove={(event) => {
          if (cinemaMode) {
            revealChrome();
            return;
          }
          if (event.pointerType === "mouse") revealChrome();
        }}
        onPointerDown={(event) => {
          if (cinemaMode) {
            if (event.target.closest(".live-video-chrome, .reader-playback, .live-video-cinema-back, .live-video-servers, .plyr__controls, .plyr__menu")) return;
            revealChrome();
            return;
          }
          if (event.target.closest(".live-video-chrome, .reader-playback, .live-video-cinema-back, .live-video-servers")) return;
          if (event.target.closest(".live-video-player, .live-video-player-frame, video")) return;
          revealChrome();
        }}
      >
        {cinemaMode && (
          <div
            className={`live-video-chrome live-video-chrome--top${chromeVisible ? " is-visible" : ""}`}
          >
            <button
              type="button"
              className="live-video-cinema-back"
              onClick={onBack}
              aria-label={t("reader.header.back")}
            >
              <ChevronRight size={18} />
            </button>
            <div className="live-video-cinema-title">
              <b>{episodeLabel}</b>
              <span>{manga.title}</span>
            </div>
          </div>
        )}
        <div className="live-video-stage" onPointerUp={handleVideoSurfacePointerUp}>
        {error ? (
          <div className="reader-live-state live-video-state">
            <Wifi size={30} />
            <h2>{presentation.loadError}</h2>
            <p>{error}</p>
          </div>
        ) : !data ? (
          <div className="reader-live-state live-video-state">
            <RefreshCw size={28} />
            <h2>{presentation.loadingContent}</h2>
          </div>
        ) : !playback ? (
          <div className="reader-live-state live-video-state">
            <Clapperboard size={30} />
            <h2>{t("reader.videoUnavailable")}</h2>
            <p>{t("reader.videoUnavailableHint")}</p>
            <button type="button" className="primary-button" onClick={() => window.open(activeChapter.url, "_blank", "noopener,noreferrer")}>
              {t("reader.openOnSource", { source: profile.name })}
            </button>
          </div>
        ) : (
          <div className="live-video-player-wrap">
            {playback.mode === "hls" ? (
              <PlyrHlsPlayer
                key={`${activeChapter.url}-${activeSourceIndex}-${hlsRetryKey}`}
                videoRef={videoRef}
                className="live-video-player"
                src={playback.url}
                poster={manga.cover}
                subtitles={subtitleTracks}
                subtitlesEnabled={subtitlesEnabled}
                loadingLabel={presentation.loadingContent}
                onError={handleHlsError}
                onReady={handleHlsReady}
                onPlyrInstance={(instance) => {
                  plyrInstanceRef.current = instance;
                  setPlyrInstance(instance);
                }}
              />
            ) : playback.mode === "embed" ? (
              <div className="live-video-embed" ref={embedRef}>
                <EmbedPlayerFrame
                  src={playback.url}
                  title={data.title || episodeLabel}
                />
              </div>
            ) : (
              <video
                ref={videoRef}
                className="live-video-player"
                src={playback.url}
                playsInline
                preload="metadata"
                controls={false}
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture={false}
              />
            )}
          </div>
        )}
        </div>
        {skipFlash && (
          <div
            className={`live-video-skip-flash live-video-skip-flash--${skipFlash}`}
            aria-hidden="true"
          >
            {skipFlash === "back" ? <RotateCcw size={30} /> : <RotateCw size={30} />}
            <span>{t("reader.playback.secondsShort", { n: SKIP_SECONDS })}</span>
          </div>
        )}
        {playback && !embedMode && !usePlyrPlayer && (
          <div
            className={`live-video-chrome live-video-chrome--controls${chromeVisible ? " is-visible" : ""}`}
            onPointerEnter={handleChromeInteractionStart}
            onPointerLeave={handleChromeInteractionEnd}
            onPointerDown={handleChromeInteractionStart}
            onPointerUp={handleChromeInteractionEnd}
            onPointerCancel={handleChromeInteractionEnd}
          >
            <VideoPlaybackControls
              progress={progress}
              buffered={buffered}
              currentTime={currentTime}
              duration={duration}
              playing={playing}
              embedMode={false}
              playbackRate={playbackRate}
              volume={volume}
              muted={muted}
              pipSupported={pipSupported}
              isFullscreen={isFullscreen || immersiveMode}
              showMarkComplete={progress < VIDEO_COMPLETE_THRESHOLD}
              subtitlesAvailable={subtitleTracks.length > 0}
              subtitlesEnabled={subtitlesEnabled}
              onToggleSubtitles={() => {
                setSubtitlesEnabled((value) => !value);
                revealChrome();
              }}
              onSeek={(value) => {
                seekToPercent(value);
                revealChrome();
              }}
              onTogglePlay={() => {
                togglePlay();
                revealChrome();
              }}
              onSkip={(seconds) => {
                skipBy(seconds);
                revealChrome();
              }}
              onCycleSpeed={() => {
                cyclePlaybackSpeed();
                revealChrome();
              }}
              onVolumeChange={(value) => {
                handleVolumeChange(value);
                revealChrome();
              }}
              onToggleMute={() => {
                toggleMute();
                revealChrome();
              }}
              onPictureInPicture={async () => {
                await requestPictureInPicture();
                revealChrome();
              }}
              onMarkComplete={() => {
                markComplete();
                revealChrome();
              }}
              previousChapter={previousChapter}
              nextChapter={nextChapter}
              onPrevious={() => {
                changeChapter(previousChapter);
                revealChrome();
              }}
              onNext={() => {
                changeChapter(nextChapter);
                revealChrome();
              }}
              onClose={hideChrome}
              onFullscreen={requestFullscreen}
              unitLabel={presentation.headerUnit}
              className={cinemaMode ? "reader-playback--overlay" : "reader-playback--docked"}
              compact={cinemaMode || phoneLandscape}
            />
          </div>
        )}
      </div>
  );

  return (
    <div className={`reader live-reader live-reader--video reader--theme-night${isChromebookApp ? " live-reader--desktop live-reader--watch" : ""}${cinemaMode ? " live-reader--cinema" : ""}${immersiveLock ? " live-reader--immersive-lock" : ""}`} dir={dir}>
      {watchDesktopLayout ? (
        <>
          <header className="video-watch-header" dir={dir}>
            <button type="button" className="video-watch-header__back" onClick={onBack} aria-label={t("reader.header.back")}>
              <ArrowRight size={18} className="video-watch-header__back-icon" aria-hidden="true" />
            </button>
            <button type="button" className="video-watch-header__title" onClick={onOpenDetails} dir={dir}>
              <strong dir="ltr">{manga.title}</strong>
              <span dir="ltr">{profile.name}</span>
            </button>
            <div className="video-watch-header__actions">
              <button
                type="button"
                className={`video-watch-header__action${isFavorite ? " active" : ""}`}
                onClick={(event) => {
                  if (!isFavorite) burstSakuraFrom(event.currentTarget);
                  onToggleFavorite();
                }}
                aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")}
                aria-pressed={isFavorite}
              >
                <Bookmark size={17} fill={isFavorite ? "currentColor" : "none"} />
              </button>
              <a
                className="video-watch-header__action"
                href={activeChapter.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("reader.header.openInSource", { unit: presentation.headerUnit })}
              >
                <ExternalLink size={17} />
              </a>
            </div>
          </header>
          <div className={`video-watch-layout${showEpisodePlaylist ? " video-watch-layout--series" : ""}`}>
            <div className="video-watch-main">
              {immersiveRoot}
              {serverBar}
              <div className="video-watch-meta">
                <h1 className="video-watch-meta__episode" dir="auto">{episodeLabel}</h1>
                <button type="button" className="video-watch-meta__series" onClick={onOpenDetails} dir="auto">
                  {manga.title}
                </button>
                <div className="video-watch-meta__facts">
                  <span>{profile.name}</span>
                  {progress > 0 ? <span>{Math.round(progress)}%</span> : null}
                </div>
                {markCompleteAction}
              </div>
            </div>
            {showEpisodePlaylist ? (
              <aside className="video-watch-playlist" aria-label={presentation.sectionTitle}>
                <div className="video-watch-playlist__head">
                  <h2>{presentation.sectionTitle}</h2>
                  <span>{chapters.length}</span>
                </div>
                <div className="video-watch-playlist__list" ref={playlistScrollerRef}>
                  {playlistChapters.map((entry) => {
                    const isActive = entry.url === activeChapter.url
                      || (entry.number && String(entry.number) === String(activeChapter.number));
                    const entryProgress = getChapterProgress(sourceId, entry.url);
                    const entryLabel = formatEpisodeHeaderLabel(entry.number || entry.name, presentation.headerUnit);
                    return (
                      <button
                        key={entry.url}
                        ref={isActive ? activePlaylistItemRef : null}
                        type="button"
                        className={`video-watch-playlist__item${isActive ? " is-active" : ""}${entryProgress >= VIDEO_COMPLETE_THRESHOLD ? " is-complete" : ""}`}
                        onClick={() => changeChapter(entry)}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className="video-watch-playlist__index" aria-hidden="true">
                          {entry.number || "—"}
                        </span>
                        <span className="video-watch-playlist__copy">
                          <strong dir="auto">{entryLabel}</strong>
                          {entry.name && entry.name !== entry.number ? <small dir="auto">{entry.name}</small> : null}
                        </span>
                        {entryProgress > 0 && entryProgress < VIDEO_COMPLETE_THRESHOLD ? (
                          <span className="video-watch-playlist__progress">{entryProgress}%</span>
                        ) : null}
                        {entryProgress >= VIDEO_COMPLETE_THRESHOLD ? (
                          <Check size={14} className="video-watch-playlist__done" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {isChromebookApp ? (
                  <ThemedScrollbar scrollerRef={playlistScrollerRef} className="desktop-scroll--nested" />
                ) : null}
              </aside>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {!cinemaMode && (
            <ReaderHeader
              title={manga.title}
              cover={manga.cover}
              chapterName={episodeLabel}
              sourceId={sourceId}
              sourceName={profile.name}
              progress={progress}
              chapterUrl={activeChapter.url}
              isFavorite={isFavorite}
              onBack={onBack}
              onOpenDetails={onOpenDetails}
              onToggleFavorite={onToggleFavorite}
              unitLabel={presentation.headerUnit}
              previousChapter={previousChapter}
              nextChapter={nextChapter}
              onPrevious={() => changeChapter(previousChapter)}
              onNext={() => changeChapter(nextChapter)}
              hideSettings
              variant="video"
            />
          )}
          {immersiveRoot}
          {serverBar}
          {markCompleteAction}
        </>
      )}
    </div>
  );
}
