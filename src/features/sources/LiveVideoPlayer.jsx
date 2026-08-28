import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Check, ChevronRight, Clapperboard, Play, RefreshCw, RotateCcw, RotateCw, Wifi } from "lucide-react";
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
import { useI18n } from "../../i18n/I18nProvider";

const VIDEO_COMPLETE_THRESHOLD = 92;
const EMBED_TICK_MS = 15000;
const EMBED_SECONDS_PER_PERCENT = 45;
const EMBED_PROGRESS_CAP = 91;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP_SECONDS = 10;
const CHROME_IDLE_MS = 3200;
const DOUBLE_TAP_MS = 320;
const SINGLE_TAP_DELAY_MS = 280;
const SKIP_ZONE_RATIO = 0.38;

function formatServerLabel(source = {}, translate) {
  const label = String(source.label || "").trim();
  if (/^anime4up[12]$/i.test(label)) return translate("reader.stream.serverN", { n: label.replace(/anime4up/i, "") });
  return label || translate("reader.stream.server");
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
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const streamSources = useMemo(
    () => (data?.sources ?? []).filter((entry) => entry.streamUrl),
    [data?.sources],
  );

  const embedSources = useMemo(
    () => (data?.sources ?? []).filter((entry) => entry.url && !entry.streamUrl),
    [data?.sources],
  );

  const serverSources = streamSources.length ? streamSources : embedSources;

  const streamSourcesRef = useRef(streamSources);
  const activeSourceIndexRef = useRef(activeSourceIndex);
  streamSourcesRef.current = streamSources;
  activeSourceIndexRef.current = activeSourceIndex;

  const handleHlsError = useCallback(() => {
    const sources = streamSourcesRef.current;
    const index = activeSourceIndexRef.current;
    if (index + 1 < sources.length) {
      pushToast({ type: "info", message: t("reader.stream.switchingServer") });
      setActiveSourceIndex(index + 1);
      setHlsRetryKey((value) => value + 1);
      return;
    }
    pushToast({
      type: "error",
      message: t("reader.stream.playFailed"),
    });
  }, [pushToast, t]);

  const handleHlsReady = useCallback((video) => {
    setDuration(video.duration || 0);
  }, []);
  const mangaRef = useRef(manga);
  const chapterRef = useRef(activeChapter);
  const saveProgressRef = useRef(onSaveProgress);
  mangaRef.current = manga;
  chapterRef.current = activeChapter;
  saveProgressRef.current = onSaveProgress;

  const playback = useMemo(() => {
    if (!data) return null;

    const hasDirectStream = streamSources.length > 0
      || data.playbackMode === "hls"
      || Boolean(data.streamUrl || data.videoUrl);

    if (streamSources.length) {
      const source = streamSources[activeSourceIndex] ?? streamSources[0];
      const referer = source.streamReferer || data.streamReferer || data.url || activeChapter.url;
      return {
        mode: "hls",
        url: sourceStreamUrl(sourceId, source.streamUrl, referer),
        referer,
      };
    }

    const resolved = resolveVideoPlayback(data);
    if (resolved?.mode === "hls" && hasDirectStream) {
      const streamUrl = data.streamUrl || data.videoUrl || resolved.url;
      const referer = data.streamReferer || data.url || activeChapter.url;
      return {
        mode: "hls",
        url: sourceStreamUrl(sourceId, streamUrl, referer),
        referer,
      };
    }

    const embedUrl = data.embedUrl || (resolved?.mode === "embed" ? resolved.url : "");
    const embedEntry = embedSources[activeSourceIndex] ?? embedSources[0];
    const resolvedEmbedUrl = embedEntry?.url || embedUrl;
    if (!hasDirectStream && resolvedEmbedUrl) {
      return { mode: "embed", url: resolvedEmbedUrl };
    }

    return resolved;
  }, [activeChapter.url, activeSourceIndex, data, embedSources, sourceId, streamSources]);

  const embedMode = playback?.mode === "embed";
  const usePlyrPlayer = playback?.mode === "hls";
  const cinemaMode = Boolean(playback && !embedMode && !usePlyrPlayer && (immersiveMode || isFullscreen || phoneLandscape));

  useEffect(() => {
    if (!plyrInstance) return undefined;
    const onEnter = () => {
      setIsFullscreen(true);
      setImmersiveMode(true);
    };
    const onExit = () => {
      setIsFullscreen(false);
      setImmersiveMode(false);
    };
    plyrInstance.on("enterfullscreen", onEnter);
    plyrInstance.on("exitfullscreen", onExit);
    return () => {
      plyrInstance.off("enterfullscreen", onEnter);
      plyrInstance.off("exitfullscreen", onExit);
    };
  }, [plyrInstance]);

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
    if (!playing || chromeInteractingRef.current || embedMode) return;
    chromeHideTimerRef.current = window.setTimeout(() => {
      if (!chromeInteractingRef.current && playing) {
        setChromeVisible(false);
      }
    }, CHROME_IDLE_MS);
  }, [clearChromeHideTimer, embedMode, playing]);

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
    if (!playing) {
      clearChromeHideTimer();
      setChromeVisible(true);
      return undefined;
    }
    if (chromeVisible) scheduleChromeHide();
    return clearChromeHideTimer;
  }, [chromeVisible, clearChromeHideTimer, embedMode, playback, playing, scheduleChromeHide]);

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
    const source = streamSources[activeSourceIndex] ?? streamSources[0];
    const referer = source?.streamReferer || data.streamReferer || data.url || activeChapter.url;
    const tracks = source?.subtitleTracks?.length
      ? source.subtitleTracks
      : (data.subtitleTracks || []);
    return tracks.map((track) => ({
      ...track,
      url: sourceSubtitleUrl(sourceId, track.url, referer),
    }));
  }, [activeChapter.url, activeSourceIndex, data, embedMode, sourceId, streamSources]);

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
      const active = Boolean(root && getFullscreenElement() === root);
      setIsFullscreen(active);
      if (!active) setImmersiveMode(false);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  const pipSupported = typeof document !== "undefined"
    && document.pictureInPictureEnabled !== false
    && typeof HTMLVideoElement !== "undefined"
    && typeof HTMLVideoElement.prototype.requestPictureInPicture === "function";

  useEffect(() => {
    if (!playback || embedMode) return undefined;

    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const video = videoRef.current;
      if (!video) return;
      revealChrome();

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "ArrowLeft":
        case "j":
        case "J":
          event.preventDefault();
          if (video.duration) {
            video.currentTime = Math.max(0, video.currentTime - (event.shiftKey ? 30 : SKIP_SECONDS));
          }
          break;
        case "ArrowRight":
        case "l":
        case "L":
          event.preventDefault();
          if (video.duration) {
            video.currentTime = Math.min(video.duration, video.currentTime + (event.shiftKey ? 30 : SKIP_SECONDS));
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          video.muted = false;
          setVolume(video.volume);
          setMuted(false);
          break;
        case "ArrowDown":
          event.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          video.muted = video.volume === 0;
          setVolume(video.volume);
          setMuted(video.muted);
          break;
        case "m":
        case "M":
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
          if (pipSupported) {
            event.preventDefault();
            if (document.pictureInPictureElement) document.exitPictureInPicture?.();
            else video.requestPictureInPicture?.().catch(() => {});
          }
          break;
        case "<":
        case ",":
          event.preventDefault();
          setPlaybackRate((current) => {
            const index = PLAYBACK_SPEEDS.indexOf(current);
            return PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length];
          });
          break;
        case "c":
        case "C":
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
    if (!playback || embedMode || usePlyrPlayer) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".live-video-servers, .live-video-chrome, .reader-playback, .live-video-mark-complete, button, a, input, label")) {
      return;
    }

    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;

    const xRatio = (event.clientX - rect.left) / rect.width;
    const now = Date.now();
    const last = tapStateRef.current;

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
    if (playing) scheduleChromeHide();
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
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const root = fullscreenRootRef.current;
    if (root && getFullscreenElement() === root) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
    unlockOrientation();
    setImmersiveMode(false);
    setIsFullscreen(false);
  }

  async function requestFullscreen() {
    const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
    const root = fullscreenRootRef.current;
    const plyr = plyrInstanceRef.current;

    if (getFullscreenElement() || immersiveMode || isFullscreen) {
      if (plyr?.fullscreen?.active) {
        plyr.fullscreen.exit();
      }
      await exitCinemaMode();
      return;
    }

    if (!root) return;

    setChromeVisible(true);
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      } else if (plyr?.fullscreen?.enabled) {
        plyr.fullscreen.enter();
        return;
      } else {
        const video = videoRef.current;
        if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
          return;
        }
        setImmersiveMode(true);
        return;
      }
      setImmersiveMode(true);
    } catch {
      if (plyr?.fullscreen?.enabled) {
        try {
          plyr.fullscreen.enter();
          return;
        } catch {
          // fall through
        }
      }
      const video = videoRef.current;
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
      setImmersiveMode(true);
    }
    lockLandscapeOrientation().catch(() => {});
  }

  const episodeLabel = formatEpisodeHeaderLabel(
    activeChapter.number || activeChapter.name,
    presentation.headerUnit,
  );

  const immersiveLock = immersiveMode && !isFullscreen;

  return (
    <div className={`reader live-reader live-reader--video reader--theme-night${cinemaMode ? " live-reader--cinema" : ""}${immersiveLock ? " live-reader--immersive-lock" : ""}`} dir={dir}>
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
      <div
        ref={fullscreenRootRef}
        className={`live-video-immersive-root${cinemaMode ? " is-cinema" : ""}${chromeVisible ? " is-chrome-visible" : " is-chrome-hidden"}`}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") revealChrome();
        }}
        onPointerDown={(event) => {
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
            {serverSources.length > 1 && (
              <div
                className={`live-video-servers${cinemaMode ? ` live-video-chrome live-video-chrome--servers${chromeVisible ? " is-visible" : ""}` : ""}`}
                aria-label={t("reader.stream.serversAria")}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {serverSources.map((source, index) => (
                  <button
                    key={`${source.url}-${index}`}
                    type="button"
                    className={`live-video-servers__chip${index === activeSourceIndex ? " active" : ""}`}
                    onClick={() => {
                      setActiveSourceIndex(index);
                      setHlsRetryKey((value) => value + 1);
                    }}
                    aria-pressed={index === activeSourceIndex}
                  >
                    {formatServerLabel(source, t)}
                  </button>
                ))}
              </div>
            )}
            {embedMode && (
              <p className="live-video-embed-hint">
                {t("reader.stream.embedHint")}
              </p>
            )}
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
                {progress < VIDEO_COMPLETE_THRESHOLD && (
                  <button
                    type="button"
                    className="live-video-mark-complete"
                    onClick={markComplete}
                  >
                    <Check size={13} aria-hidden="true" />
                    {presentation.type === "movie" ? t("reader.stream.markMovieComplete") : t("reader.stream.markEpisodeComplete")}
                  </button>
                )}
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
    </div>
  );
}
