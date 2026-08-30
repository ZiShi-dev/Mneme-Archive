import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bookmark, Check, ChevronRight, Clapperboard, ExternalLink, Maximize2, RefreshCw, RotateCcw, RotateCw, Wifi } from "lucide-react";
import { burstSakuraFrom } from "../../lib/sakura/burst";
import { unlockOrientation } from "../../lib/video/orientationLock";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { getChapterProgress, setChapterProgress } from "../../lib/storage/chapterProgress";
import { ReaderHeader } from "./ReaderHeader";
import { VideoPlaybackControls } from "./VideoPlaybackControls";
import { PlyrHlsPlayer } from "./PlyrHlsPlayer";
import { EmbedPlayerFrame } from "./EmbedPlayerFrame";
import { getItemType } from "./contentTypes";
import { getMediaPresentation, formatEpisodeHeaderLabel } from "./mediaPresentation";
import { isChromebookApp } from "../../config/appFlavor";
import { scrollAppToTop } from "../../lib/platform/scrollRoot";
import { useI18n } from "../../i18n/I18nProvider";
import {
  EMBED_PROGRESS_CAP,
  EMBED_SECONDS_PER_PERCENT,
  EMBED_TICK_MS,
  formatServerLabel,
  PLAYBACK_SPEEDS,
  SKIP_SECONDS,
  SINGLE_TAP_DELAY_MS,
  SKIP_ZONE_RATIO,
  DOUBLE_TAP_MS,
  VIDEO_COMPLETE_THRESHOLD,
} from "./liveVideo/constants";
import { useVideoChapterSession } from "./liveVideo/useVideoChapterSession";
import { useVideoCinemaChrome } from "./liveVideo/useVideoCinemaChrome";
import { VideoStageSkeleton } from "../../components/ui/ContentSkeleton";
import { VideoEpisodePlaylist } from "./liveVideo/VideoEpisodePlaylist";
import { VideoSubtitleOverlay } from "./liveVideo/VideoSubtitleOverlay";
import { useFetchedSubtitles } from "./liveVideo/useFetchedSubtitles";

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
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [skipFlash, setSkipFlash] = useState(null);
  const videoRef = useRef(null);
  const [plyrInstance, setPlyrInstance] = useState(null);
  const plyrInstanceRef = useRef(null);
  const embedRef = useRef(null);
  const singleTapTimerRef = useRef(0);
  const skipFlashTimerRef = useRef(0);
  const tapStateRef = useRef({ time: 0, x: 0 });
  const completedRef = useRef(false);
  const playErrorAtRef = useRef(0);

  const mangaRef = useRef(manga);
  const saveProgressRef = useRef(onSaveProgress);
  mangaRef.current = manga;
  saveProgressRef.current = onSaveProgress;

  const onChapterLoadStart = useCallback(() => {
    setPlaying(false);
    setBuffered(0);
    setSubtitlesEnabled(true);
    completedRef.current = false;
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const {
    activeChapter,
    chapters,
    data,
    error,
    activeSourceIndex,
    hlsRetryKey,
    orderedSources,
    playback,
    embedMode,
    usePlyrPlayer,
    subtitleTracks,
    handleHlsError,
    selectSource,
    changeChapter,
    initialProgress,
  } = useVideoChapterSession({
    manga,
    chapter,
    sourceId,
    presentation,
    pushToast,
    t,
    onChapterLoadStart,
  });

  const { cues: subtitleCues, loading: subtitlesLoading } = useFetchedSubtitles(
    subtitleTracks,
    !embedMode && subtitlesEnabled,
  );

  const chapterRef = useRef(activeChapter);
  chapterRef.current = activeChapter;

  const handleHlsReady = useCallback((video) => {
    setDuration(video.duration || 0);
  }, []);

  const {
    chromeVisible,
    revealChrome,
    hideChrome,
    isFullscreen,
    immersiveMode,
    cinemaMode,
    cssFullscreen,
    bindImmersiveRoot,
    requestFullscreen,
    handleChromeInteractionStart,
    handleChromeInteractionEnd,
    phoneLandscape,
    pipSupported,
    resetChromeOnChapterChange,
  } = useVideoCinemaChrome({
    playback,
    embedMode,
    usePlyrPlayer,
    playing,
    plyrInstance,
    plyrInstanceRef,
  });

  const requestEmbedFullscreen = useCallback(async () => {
    const node = embedRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (node.requestFullscreen) {
        await node.requestFullscreen();
      } else if (node.webkitRequestFullscreen) {
        await node.webkitRequestFullscreen();
      }
    } catch {
      pushToast({ type: "error", message: t("reader.stream.playFailed") });
    }
  }, [pushToast, t]);

  useEffect(() => {
    resetChromeOnChapterChange();
    completedRef.current = false;
    setProgress(initialProgress);
  }, [activeChapter.url, initialProgress, resetChromeOnChapterChange]);

  useEffect(() => () => {
    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    if (skipFlashTimerRef.current) window.clearTimeout(skipFlashTimerRef.current);
    unlockOrientation();
  }, []);

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
    if (!video || playback?.mode !== "video" || embedMode) return undefined;

    const syncSubtitleTracks = () => {
      const captionTracks = [...video.textTracks].filter(
        (track) => track.kind === "subtitles" || track.kind === "captions",
      );
      if (!captionTracks.length) return;

      for (const track of captionTracks) {
        track.mode = "hidden";
      }
      if (!subtitlesEnabled) return;

      const activeTrack = captionTracks.find((track) => track.default) || captionTracks[0];
      if (activeTrack) activeTrack.mode = "showing";
    };

    video.addEventListener("loadedmetadata", syncSubtitleTracks);
    video.addEventListener("addtrack", syncSubtitleTracks);
    syncSubtitleTracks();
    return () => {
      video.removeEventListener("loadedmetadata", syncSubtitleTracks);
      video.removeEventListener("addtrack", syncSubtitleTracks);
    };
  }, [embedMode, playback?.mode, playback?.url, subtitleTracks, subtitlesEnabled]);

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
          requestFullscreen(videoRef);
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
  }, [embedMode, pipSupported, playback, revealChrome, requestFullscreen]);

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
      if (event.target.closest(".live-video-embed, .live-video-embed__frame, iframe")) {
        return;
      }
      if (now - last.time <= DOUBLE_TAP_MS && xRatio > SKIP_ZONE_RATIO && xRatio < 1 - SKIP_ZONE_RATIO) {
        tapStateRef.current = { time: 0, x: 0 };
        void requestEmbedFullscreen();
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

  const episodeLabel = formatEpisodeHeaderLabel(
    activeChapter.number || activeChapter.name,
    presentation.headerUnit,
  );

  const immersiveLock = immersiveMode && !isFullscreen;
  const watchDesktopLayout = isChromebookApp;

  const markCompleteAction = playback && progress < VIDEO_COMPLETE_THRESHOLD ? (
    <button
      type="button"
      className={`live-video-mark-complete${watchDesktopLayout ? " live-video-mark-complete--meta" : ""}`}
      onClick={markComplete}
    >
      <Check size={13} aria-hidden="true" />
      {presentation.type === "movie" ? t("reader.stream.markMovieComplete") : t("reader.stream.markEpisodeComplete")}
    </button>
  ) : null;

  const showStandaloneMarkComplete = Boolean(
    markCompleteAction && (watchDesktopLayout || embedMode || usePlyrPlayer),
  );

  const serverBar = orderedSources.length > 0 && data && !cinemaMode ? (
    <div
      className={`live-video-servers live-video-servers--dock${embedMode ? " live-video-servers--embed" : ""}`}
      aria-label={t("reader.stream.serversAria")}
    >
      <div className="live-video-servers__chips">
        {orderedSources.map((source, index) => (
          <button
            key={`${source.url}-${index}`}
            type="button"
            className={`live-video-servers__chip${index === activeSourceIndex ? " active" : ""}${source.streamUrl ? " live-video-servers__chip--native" : ""}`}
            onClick={() => selectSource(index)}
            aria-pressed={index === activeSourceIndex}
          >
            {formatServerLabel(source, t)}
          </button>
        ))}
      </div>
      {embedMode ? (
        <p className="live-video-servers__hint">{t("reader.stream.embedFallback")}</p>
      ) : null}
    </div>
  ) : null;

  const immersiveRoot = (
      <div
        ref={bindImmersiveRoot}
        className={`live-video-immersive-root${cinemaMode ? " is-cinema" : ""}${embedMode ? " is-embed" : ""}${cssFullscreen ? " plyr--fullscreen-fallback" : ""}${chromeVisible ? " is-chrome-visible" : " is-chrome-hidden"}`}
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
        <div className={`live-video-stage${embedMode ? " live-video-stage--embed" : ""}`} onPointerUp={handleVideoSurfacePointerUp}>
        {error ? (
          <div className="reader-live-state live-video-state">
            <Wifi size={30} />
            <h2>{presentation.loadError}</h2>
            <p>{error}</p>
          </div>
        ) : !data ? (
          <VideoStageSkeleton label={presentation.loadingContent} />
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
              <>
                <PlyrHlsPlayer
                  key={`${activeChapter.url}-${activeSourceIndex}-${hlsRetryKey}`}
                  videoRef={videoRef}
                  className="live-video-player"
                  src={playback.url}
                  poster={manga.cover}
                  subtitles={[]}
                  subtitlesEnabled={false}
                  loadingLabel={presentation.loadingContent}
                  onError={handleHlsError}
                  onReady={handleHlsReady}
                  onPlyrInstance={(instance) => {
                    plyrInstanceRef.current = instance;
                    setPlyrInstance(instance);
                  }}
                />
                {!embedMode && subtitleTracks.length > 0 ? (
                  <VideoSubtitleOverlay
                    cues={subtitleCues}
                    currentTime={currentTime}
                    enabled={subtitlesEnabled}
                    loading={subtitlesLoading}
                    loadingLabel={t("reader.playback.preparingSubtitles")}
                  />
                ) : null}
              </>
            ) : playback.mode === "embed" ? (
              <div className="live-video-embed" ref={embedRef}>
                <EmbedPlayerFrame
                  src={playback.url}
                  title={data.title || episodeLabel}
                />
                <button
                  type="button"
                  className="live-video-embed-fullscreen"
                  onClick={() => { void requestEmbedFullscreen(); }}
                  aria-label={t("reader.plyr.enterFullscreen")}
                >
                  <Maximize2 size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="live-video-player-frame live-video-player-frame--native">
                <video
                  ref={videoRef}
                  className="live-video-player"
                  src={playback.url}
                  playsInline
                  preload="metadata"
                  controls={false}
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture={false}
                  onError={handleHlsError}
                />
                {!embedMode && subtitleTracks.length > 0 ? (
                  <VideoSubtitleOverlay
                    cues={subtitleCues}
                    currentTime={currentTime}
                    enabled={subtitlesEnabled}
                    loading={subtitlesLoading}
                    loadingLabel={t("reader.playback.preparingSubtitles")}
                  />
                ) : null}
              </div>
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
              onFullscreen={() => requestFullscreen(videoRef)}
              unitLabel={presentation.headerUnit}
              className={cinemaMode ? "reader-playback--overlay" : "reader-playback--docked"}
              compact={cinemaMode || phoneLandscape}
            />
          </div>
        )}
        {!watchDesktopLayout && serverBar}
        {!watchDesktopLayout && showStandaloneMarkComplete ? markCompleteAction : null}
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
                {showStandaloneMarkComplete ? markCompleteAction : null}
              </div>
            </div>
            {showEpisodePlaylist ? (
              <VideoEpisodePlaylist
                chapters={chapters}
                activeChapter={activeChapter}
                sourceId={sourceId}
                presentation={presentation}
                onSelectChapter={changeChapter}
              />
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
        </>
      )}
    </div>
  );
}
