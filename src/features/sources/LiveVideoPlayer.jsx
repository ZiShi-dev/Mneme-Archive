import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, RotateCcw, RotateCw, Wifi } from "lucide-react";
import { unlockOrientation } from "../../lib/video/orientationLock";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { getChapterProgress, setChapterProgress } from "../../lib/storage/chapterProgress";
import { VideoPlaybackControls } from "./VideoPlaybackControls";
import { PlyrHlsPlayer } from "./PlyrHlsPlayer";
import { EmbedPlayerFrame } from "./EmbedPlayerFrame";
import { getItemType } from "./contentTypes";
import { getMediaPresentation, formatVideoChapterNavLabel } from "./mediaPresentation";
import { isChromebookApp } from "../../config/appFlavor";
import { scrollAppToTop } from "../../lib/platform/scrollRoot";
import { useI18n } from "../../i18n/I18nProvider";
import {
  formatUniqueServerLabels,
  PLAYBACK_SPEEDS,
  SKIP_SECONDS,
  SINGLE_TAP_DELAY_MS,
  SKIP_ZONE_RATIO,
  DOUBLE_TAP_MS,
} from "./liveVideo/constants";
import { useVideoChapterSession } from "./liveVideo/useVideoChapterSession";
import { useVideoCinemaChrome } from "./liveVideo/useVideoCinemaChrome";
import { VideoStageSkeleton } from "../../components/ui/ContentSkeleton";
import { VideoEpisodePlaylist } from "./liveVideo/VideoEpisodePlaylist";
import { VideoSubtitleOverlay } from "./liveVideo/VideoSubtitleOverlay";
import { VideoServerSheet } from "./liveVideo/VideoServerSheet";
import { VideoEpisodeHeader } from "./liveVideo/VideoEpisodeHeader";
import { useFetchedSubtitles } from "./liveVideo/useFetchedSubtitles";

export function LiveVideoPlayer({
  manga,
  chapter,
  preferredSourceIndex,
  prefetchData,
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
  const [serversOpen, setServersOpen] = useState(false);
  const videoRef = useRef(null);
  const [plyrInstance, setPlyrInstance] = useState(null);
  const plyrInstanceRef = useRef(null);
  const embedRef = useRef(null);
  const singleTapTimerRef = useRef(0);
  const skipFlashTimerRef = useRef(0);
  const tapStateRef = useRef({ time: 0, x: 0 });
  const chromeAtGestureStartRef = useRef(false);
  const completedRef = useRef(false);
  const playErrorAtRef = useRef(0);

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
    preferredSourceIndex,
    prefetchData,
  });

  const { cues: subtitleCues, loading: subtitlesLoading } = useFetchedSubtitles(
    subtitleTracks,
    !embedMode && subtitlesEnabled,
  );


  const handleHlsReady = useCallback((video) => {
    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration || 0);
    setPlaying(!video.paused);
  }, []);

  const {
    chromeVisible,
    revealChrome,
    hideChrome,
    isFullscreen,
    immersiveMode,
    cinemaMode,
    isVideoImmersive,
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
    netflixMode: true,
  });

  useEffect(() => {
    resetChromeOnChapterChange();
    completedRef.current = false;
    setProgress(initialProgress);
    setServersOpen(false);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || playback.mode === "embed") return undefined;

    const syncPlaying = () => setPlaying(!video.paused);
    const syncDuration = () => {
      const nextDuration = video.duration;
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration);
      }
    };

    const onTimeUpdate = () => {
      const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
      const nextTime = video.currentTime || 0;
      const nextProgress = nextDuration > 0 ? Math.round((nextTime / nextDuration) * 100) : 0;
      setDuration(nextDuration);
      setCurrentTime(nextTime);
      setProgress(nextProgress);
      if (nextProgress > 0) {
        setChapterProgress(sourceId, activeChapter.url, nextProgress);
        if (onSaveProgress && !completedRef.current) {
          onSaveProgress(manga, activeChapter, nextProgress, { completed: false });
        }
      }
    };

    const onEnded = () => {
      setPlaying(false);
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
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    syncPlaying();
    syncDuration();
    if (video.readyState >= 1) onProgress();
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [activeChapter, manga, onSaveProgress, playback?.mode, playback?.url, sourceId, plyrInstance]);

  useEffect(() => {
    const plyr = plyrInstance;
    if (!plyr || !usePlyrPlayer) return undefined;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    plyr.on("play", onPlay);
    plyr.on("pause", onPause);
    setPlaying(plyr.playing);

    return () => {
      plyr.off("play", onPlay);
      plyr.off("pause", onPause);
    };
  }, [plyrInstance, usePlyrPlayer, playback?.url]);

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
    const plyr = plyrInstanceRef.current;
    if (usePlyrPlayer && plyr?.pip) {
      plyr.pip.toggle();
      return;
    }
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
    if (!chromeAtGestureStartRef.current) {
      revealChrome({ autoHide: true });
      return;
    }
    hideChrome();
  }

  function handleVideoSurfacePointerDown(event) {
    if (!playback) return;
    if (event.target.closest(".live-video-servers, .live-video-chrome, .reader-playback, .live-video-mark-complete, button, a, input, label")) {
      return;
    }
    if (usePlyrPlayer && event.target.closest(".plyr__controls, .plyr__menu")) return;
    chromeAtGestureStartRef.current = chromeVisible;
  }

  function handleVideoSurfacePointerUp(event) {
    if (!playback) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest(".live-video-servers, .live-video-chrome, .reader-playback, .live-video-mark-complete, button, a, input, label")) {
      return;
    }
    if (usePlyrPlayer && event.target.closest(".plyr__controls, .plyr__menu")) return;

    const stage = event.currentTarget;
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;

    const xRatio = (event.clientX - rect.left) / rect.width;
    const now = Date.now();
    const last = tapStateRef.current;

    if (embedMode && event.target.closest("iframe")) return;

    if (now - last.time <= DOUBLE_TAP_MS) {
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = 0;
      tapStateRef.current = { time: 0, x: 0 };

      if (!embedMode) {
        if (xRatio < SKIP_ZONE_RATIO) {
          skipBy(-SKIP_SECONDS);
          showSkipFlash("back");
          revealChrome({ autoHide: true });
          return;
        }
        if (xRatio > 1 - SKIP_ZONE_RATIO) {
          skipBy(SKIP_SECONDS);
          showSkipFlash("forward");
          revealChrome({ autoHide: true });
          return;
        }
      }
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
    const plyr = plyrInstanceRef.current;
    if (usePlyrPlayer && plyr) {
      plyr.togglePlay();
      window.setTimeout(() => setPlaying(plyr.playing), 0);
      return;
    }
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

  const isMovie = presentation.type === "movie";
  const episodeLabel = formatVideoChapterNavLabel(activeChapter, presentation.headerUnit);
  const headerEpisodeLabel = isMovie ? (manga.title || episodeLabel) : episodeLabel;
  const headerSeriesTitle = isMovie ? (profile.name || "") : manga.title;

  const useNetflixLayout = true;
  const watchDesktopLayout = isChromebookApp;
  const isTheaterFullscreen = useNetflixLayout && Boolean(immersiveMode || isFullscreen || cssFullscreen);
  const videoEdgeToEdge = (useNetflixLayout && Boolean(playback)) || isTheaterFullscreen;
  const controlsChromeVisible = chromeVisible;

  const serverLabels = useMemo(
    () => formatUniqueServerLabels(orderedSources, t),
    [orderedSources, t],
  );
  const activeServerLabel = serverLabels[activeSourceIndex] ?? serverLabels[0] ?? "";
  const showServerPicker = orderedSources.length > 0 && Boolean(data);

  const openServers = useCallback(() => {
    setServersOpen(true);
    revealChrome();
  }, [revealChrome]);

  const serverSheet = showServerPicker ? (
    <VideoServerSheet
      open={serversOpen}
      onClose={() => setServersOpen(false)}
      serverLabels={serverLabels}
      activeIndex={activeSourceIndex}
      embedOnlyServer={embedMode}
      onSelect={(index) => {
        selectSource(index);
        setServersOpen(false);
        revealChrome();
      }}
    />
  ) : null;

  const pinChrome = useCallback(() => {
    handleChromeInteractionStart();
    revealChrome({ autoHide: false });
    handleChromeInteractionEnd();
  }, [handleChromeInteractionEnd, handleChromeInteractionStart, revealChrome]);

  const nudgeChrome = useCallback((options = {}) => {
    if (useNetflixLayout) {
      pinChrome();
      return;
    }
    revealChrome(options);
  }, [pinChrome, revealChrome, useNetflixLayout]);

  const playbackControlProps = {
    progress,
    buffered,
    currentTime,
    duration,
    playing,
    embedMode,
    netflixMode: useNetflixLayout,
    hideFullscreen: embedMode,
    playbackRate,
    volume,
    muted,
    pipSupported,
    isFullscreen: isFullscreen || immersiveMode,
    subtitlesAvailable: subtitleTracks.length > 0,
    subtitlesEnabled,
    onToggleSubtitles: () => {
      setSubtitlesEnabled((value) => !value);
      nudgeChrome();
    },
    onSeek: (value) => {
      seekToPercent(value);
      revealChrome({ autoHide: false });
    },
    onSeekEnd: (value) => {
      seekToPercent(value);
      handleChromeInteractionStart();
      handleChromeInteractionEnd();
    },
    onTogglePlay: () => {
      togglePlay();
      nudgeChrome();
    },
    onSkip: (seconds) => {
      skipBy(seconds);
      nudgeChrome();
    },
    onCycleSpeed: () => {
      cyclePlaybackSpeed();
      nudgeChrome();
    },
    onVolumeChange: (value) => {
      handleVolumeChange(value);
      nudgeChrome();
    },
    onToggleMute: () => {
      toggleMute();
      nudgeChrome();
    },
    onPictureInPicture: async () => {
      await requestPictureInPicture();
      nudgeChrome();
    },
    previousChapter,
    nextChapter,
    onPrevious: () => {
      changeChapter(previousChapter);
      nudgeChrome();
    },
    onNext: () => {
      changeChapter(nextChapter);
      nudgeChrome();
    },
    onClose: hideChrome,
    onFullscreen: () => {
      requestFullscreen(videoRef);
      revealChrome({ autoHide: true });
    },
    showServerPicker,
    currentServerLabel: activeServerLabel,
    onOpenServers: openServers,
    unitLabel: presentation.headerUnit,
    compact: cinemaMode || phoneLandscape,
  };

  const chromeInteractionHandlers = {
    onPointerDown: (event) => {
      event.stopPropagation();
      handleChromeInteractionStart();
    },
    onPointerUp: (event) => {
      event.stopPropagation();
      handleChromeInteractionEnd();
    },
    onPointerCancel: (event) => {
      event.stopPropagation();
      handleChromeInteractionEnd();
    },
  };

  const overlayControlProps = {
    ...playbackControlProps,
    minimalOverlay: useNetflixLayout && !embedMode,
    previousChapter: useNetflixLayout && !isTheaterFullscreen ? null : previousChapter,
    nextChapter: useNetflixLayout && !isTheaterFullscreen ? null : nextChapter,
    showServerPicker: useNetflixLayout && !isTheaterFullscreen ? false : showServerPicker,
  };

  const videoEpisodeHeader = useNetflixLayout ? (
    <VideoEpisodeHeader
      visible={controlsChromeVisible}
      episodeLabel={headerEpisodeLabel}
      seriesTitle={headerSeriesTitle}
      onBack={onBack}
      onOpenDetails={onOpenDetails}
      {...chromeInteractionHandlers}
    />
  ) : null;

  const showNavDock = useNetflixLayout && Boolean(playback && data);
  const showTheaterOverlay = Boolean(playback && (!useNetflixLayout || isTheaterFullscreen));
  const showDockProgress = showNavDock && !isTheaterFullscreen && !embedMode;

  const playbackOverlay = showTheaterOverlay ? (
    <div
      className={`live-video-chrome live-video-chrome--controls${controlsChromeVisible ? " is-visible" : ""}`}
      {...chromeInteractionHandlers}
    >
      <VideoPlaybackControls
        {...overlayControlProps}
        navOnly={embedMode}
        className={useNetflixLayout || cinemaMode ? "reader-playback--overlay reader-playback--netflix" : "reader-playback--docked"}
        showClose={!useNetflixLayout && !embedMode && !usePlyrPlayer}
        compact={useNetflixLayout || cinemaMode || phoneLandscape}
      />
    </div>
  ) : null;

  const immersiveRoot = (
      <div
        ref={bindImmersiveRoot}
        className={`live-video-immersive-root${videoEdgeToEdge ? " is-video-fill" : (cinemaMode ? " is-cinema" : "")}${isTheaterFullscreen ? " is-theater-fullscreen" : ""}${useNetflixLayout ? " is-netflix has-episode-header" : ""}${showNavDock ? " has-nav-dock" : ""}${embedMode ? " is-embed" : ""}${cssFullscreen || isTheaterFullscreen ? " plyr--fullscreen-fallback" : ""}${chromeVisible ? " is-chrome-visible" : " is-chrome-hidden"}`}
        onPointerMove={(event) => {
          if (useNetflixLayout) return;
          if (isVideoImmersive) {
            revealChrome();
            return;
          }
          if (event.pointerType === "mouse") revealChrome();
        }}
        onPointerDown={(event) => {
          if (useNetflixLayout) {
            if (event.target.closest(".live-video-chrome, .video-episode-header, .video-episode-toolbar, .video-watch-dock, .reader-playback, .live-video-cinema-back, .live-video-servers, .plyr__controls, .plyr__menu")) return;
            if (!event.target.closest(".live-video-stage, .live-video-player, .live-video-player-wrap, .plyr-hls-player, video, .live-video-embed")) return;
            chromeAtGestureStartRef.current = chromeVisible;
            return;
          }
          if (isVideoImmersive) {
            if (event.target.closest(".live-video-chrome, .video-episode-header, .video-episode-toolbar, .reader-playback, .live-video-cinema-back, .live-video-servers, .plyr__controls, .plyr__menu")) return;
            if (!event.target.closest(".live-video-stage, .live-video-player, .live-video-player-wrap, .plyr-hls-player, video")) return;
            chromeAtGestureStartRef.current = chromeVisible;
            return;
          }
          if (event.target.closest(".live-video-chrome, .video-episode-header, .video-episode-toolbar, .reader-playback, .live-video-cinema-back, .live-video-servers")) return;
          if (event.target.closest(".live-video-player, .live-video-player-frame, video")) return;
          revealChrome();
        }}
      >
        {videoEpisodeHeader}
        <div className="live-video-stage-shell">
        <div className={`live-video-stage${embedMode ? " live-video-stage--embed" : ""}`} onPointerDown={handleVideoSurfacePointerDown} onPointerUp={handleVideoSurfacePointerUp}>
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
                  customChrome={useNetflixLayout}
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
                  key={`${activeChapter.url}-${activeSourceIndex}-${hlsRetryKey}`}
                  src={playback.url}
                  title={data.title || episodeLabel}
                  onBlocked={handleHlsError}
                />
                {!controlsChromeVisible ? (
                  <button
                    type="button"
                    className="live-video-embed-tapcatch"
                    aria-label={t("reader.playback.showViewControls")}
                    onClick={() => revealChrome({ autoHide: true })}
                  />
                ) : null}
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
        {showTheaterOverlay ? playbackOverlay : null}
        </div>
        {showDockProgress ? (
          <div className="video-watch-dock">
            <div
              className={`live-video-chrome live-video-chrome--controls${controlsChromeVisible ? " is-visible" : ""}`}
              {...chromeInteractionHandlers}
            >
              <VideoPlaybackControls
                {...playbackControlProps}
                previousChapter={null}
                nextChapter={null}
                showServerPicker={false}
                progressOnly
                className="reader-playback--dock-progress"
              />
            </div>
          </div>
        ) : null}
      </div>
  );

  return (
    <div className={`reader live-reader live-reader--video reader--theme-night${isChromebookApp ? " live-reader--desktop live-reader--watch" : ""}${videoEdgeToEdge ? " live-reader--video-fill" : ""}${(cinemaMode && watchDesktopLayout) || isTheaterFullscreen ? " live-reader--cinema" : ""}${isTheaterFullscreen ? " live-reader--immersive-lock" : ""}`} dir={dir}>
      {watchDesktopLayout ? (
        <div className={`video-watch-layout${showEpisodePlaylist ? " video-watch-layout--series" : ""}`}>
          <div className="video-watch-main">
            {immersiveRoot}
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
      ) : (
        immersiveRoot
      )}
      {serverSheet}
    </div>
  );
}
