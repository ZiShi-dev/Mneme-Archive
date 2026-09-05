import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { lockLandscapeOrientation, unlockOrientation } from "../../../lib/video/orientationLock";
import { isChromebookApp } from "../../../config/appFlavor";
import { installEmbedPopupGuards } from "../../../lib/video/embedHosts";
import { getDocumentFullscreenElement, isFullscreenWithinRoot } from "../../../lib/video/fullscreenTarget";
import { setNativeImmersive } from "../../../lib/video/nativeImmersive";
import { CHROME_IDLE_MS, FULLSCREEN_CHROME_IDLE_MS, NETFLIX_CHROME_IDLE_MS, CHROME_INTERACTION_END_MS } from "./constants";

export function useVideoCinemaChrome({
  playback,
  embedMode,
  usePlyrPlayer,
  playing,
  plyrInstance,
  plyrInstanceRef,
  netflixMode = false,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [phoneLandscape, setPhoneLandscape] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(() => !netflixMode);

  const fullscreenRootRef = useRef(null);
  const chromeHideTimerRef = useRef(0);
  const chromeInteractingRef = useRef(false);

  const plyrFullscreenActive = Boolean(plyrInstance?.fullscreen?.active);
  const cinemaMode = Boolean(
    playback
    && (immersiveMode || isFullscreen || plyrFullscreenActive),
  );
  const videoImmersive = Boolean(netflixMode && playback);
  const isVideoImmersive = videoImmersive || cinemaMode;
  const cssFullscreen = cinemaMode && !nativeFullscreen;

  const bindImmersiveRoot = useCallback((node) => {
    fullscreenRootRef.current = node;
  }, []);

  const syncCinemaDom = useCallback((active) => {
    const root = fullscreenRootRef.current;
    if (!root) return;
    if (active) root.classList.add("plyr--fullscreen-fallback");
    else root.classList.remove("plyr--fullscreen-fallback", "plyr--fullscreen-active");
  }, []);

  const activateCinemaMode = useCallback(() => {
    setChromeVisible(!netflixMode);
    setImmersiveMode(true);
    setIsFullscreen(true);
    syncCinemaDom(true);
  }, [netflixMode, syncCinemaDom]);

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimerRef.current) {
      window.clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = 0;
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer();
    if (chromeInteractingRef.current) return;
    if (embedMode && !isVideoImmersive) return;
    const immersivePlayback = isVideoImmersive;
    if (!immersivePlayback && !playing) return;

    const idleMs = netflixMode
      ? NETFLIX_CHROME_IDLE_MS
      : (immersivePlayback ? FULLSCREEN_CHROME_IDLE_MS : CHROME_IDLE_MS);
    chromeHideTimerRef.current = window.setTimeout(() => {
      if (!chromeInteractingRef.current && (playing || immersivePlayback)) {
        setChromeVisible(false);
      }
    }, idleMs);
  }, [clearChromeHideTimer, embedMode, isVideoImmersive, netflixMode, playing]);

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
    if (!plyrInstance) return undefined;
    const onEnter = () => {
      const nativeActive = Boolean(getDocumentFullscreenElement());
      setChromeVisible(!netflixMode);
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
  }, [netflixMode, plyrInstance, syncCinemaDom]);

  useEffect(() => {
    if (!isChromebookApp) return undefined;
    const root = document.documentElement;
    const syncCinemaClass = () => {
      if (cinemaMode) {
        root.classList.add("video-cinema-active");
        document.body.classList.add("video-cinema-active");
      } else {
        root.classList.remove("video-cinema-active");
        document.body.classList.remove("video-cinema-active");
      }
    };
    syncCinemaClass();
    document.addEventListener("fullscreenchange", syncCinemaClass);
    document.addEventListener("webkitfullscreenchange", syncCinemaClass);
    return () => {
      document.removeEventListener("fullscreenchange", syncCinemaClass);
      document.removeEventListener("webkitfullscreenchange", syncCinemaClass);
      root.classList.remove("video-cinema-active");
      document.body.classList.remove("video-cinema-active");
    };
  }, [cinemaMode]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    setNativeImmersive(isVideoImmersive).catch(() => {});
    return () => {
      setNativeImmersive(false).catch(() => {});
    };
  }, [isVideoImmersive]);

  useEffect(() => {
    if (!playback || isChromebookApp) return undefined;
    if (phoneLandscape && !isVideoImmersive && !netflixMode) {
      activateCinemaMode();
    }
    return undefined;
  }, [activateCinemaMode, isChromebookApp, isVideoImmersive, netflixMode, phoneLandscape, playback?.url]);

  useEffect(() => {
    if (!embedMode) return undefined;
    return installEmbedPopupGuards();
  }, [embedMode]);

  useEffect(() => {
    if (!playback) return undefined;
    if (embedMode && !isVideoImmersive) return undefined;
    if (!playing && !isVideoImmersive) {
      clearChromeHideTimer();
      if (!netflixMode) setChromeVisible(true);
      return undefined;
    }
    if (chromeVisible) scheduleChromeHide();
    return clearChromeHideTimer;
  }, [chromeVisible, clearChromeHideTimer, embedMode, isVideoImmersive, netflixMode, playback, playing, scheduleChromeHide]);

  useEffect(() => {
    if (!videoImmersive || netflixMode) return undefined;
    revealChrome({ autoHide: true });
    return undefined;
  }, [netflixMode, playback?.url, revealChrome, videoImmersive]);

  useEffect(() => {
    if (!cinemaMode || netflixMode) return undefined;
    revealChrome({ autoHide: true });
    return undefined;
  }, [cinemaMode, netflixMode, revealChrome]);

  useEffect(() => {
    if (!isVideoImmersive) return undefined;
    const root = fullscreenRootRef.current;
    if (!root) return undefined;

    const chromeSelector = ".plyr__controls, .plyr__menu, .live-video-chrome, .video-episode-header, .video-episode-toolbar, .video-watch-dock, .reader-playback";
    const onPointerOver = (event) => {
      if (!event.target.closest(chromeSelector)) return;
      chromeInteractingRef.current = true;
      clearChromeHideTimer();
      setChromeVisible(true);
    };
    const onPointerOut = (event) => {
      if (!event.target.closest(chromeSelector)) return;
      chromeInteractingRef.current = false;
      scheduleChromeHide();
    };

    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    return () => {
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
    };
  }, [clearChromeHideTimer, isVideoImmersive, scheduleChromeHide]);

  useEffect(() => {
    if (!playback || embedMode || (!immersiveMode && !isFullscreen)) {
      unlockOrientation();
      return undefined;
    }

    lockLandscapeOrientation().catch(() => {});
    return () => unlockOrientation();
  }, [embedMode, immersiveMode, isFullscreen, playback]);

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
    const onFullscreenChange = () => {
      const root = fullscreenRootRef.current;
      const fullscreenElement = getDocumentFullscreenElement();
      const nativeActive = isFullscreenWithinRoot(root, fullscreenElement);
      const iframeFullscreen = Boolean(nativeActive && root && fullscreenElement !== root);
      const fallbackActive = Boolean(
        root?.classList.contains("plyr--fullscreen-fallback")
        || root?.querySelector(".plyr--fullscreen-fallback, .plyr--fullscreen-active"),
      );
      const active = nativeActive || fallbackActive;
      setNativeFullscreen(nativeActive);
      setIsFullscreen(active);
      if (nativeActive) syncCinemaDom(false);
      if (iframeFullscreen) setChromeVisible(false);
      if (!active && !plyrInstanceRef.current?.fullscreen?.active) setImmersiveMode(false);
      else setImmersiveMode(true);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [plyrInstanceRef, syncCinemaDom]);

  const pipSupported = typeof document !== "undefined"
    && document.pictureInPictureEnabled !== false
    && typeof HTMLVideoElement !== "undefined"
    && typeof HTMLVideoElement.prototype.requestPictureInPicture === "function";

  async function exitCinemaMode() {
    const plyr = plyrInstanceRef.current;
    if (plyr?.fullscreen?.active) {
      plyr.fullscreen.exit();
    }

    const root = fullscreenRootRef.current;
    syncCinemaDom(false);

    if (isFullscreenWithinRoot(root)) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
    unlockOrientation();
    setImmersiveMode(false);
    setIsFullscreen(false);
    setNativeFullscreen(false);
  }

  async function requestNativeFullscreen(videoRef) {
    const root = fullscreenRootRef.current;
    const plyr = plyrInstanceRef.current;

    if (plyr?.fullscreen?.enabled) {
      plyr.fullscreen.enter();
      if (getDocumentFullscreenElement() || plyr.fullscreen?.active) return true;
    }

    if (!root) return false;

    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return Boolean(getDocumentFullscreenElement());
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
      return Boolean(getDocumentFullscreenElement());
    }

    const video = videoRef?.current;
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    }

    return false;
  }

  const requestFullscreen = useCallback(async (videoRef) => {
    const root = fullscreenRootRef.current;
    const plyr = plyrInstanceRef.current;
    const fullscreenActive = Boolean(
      cinemaMode
      || isFullscreenWithinRoot(root)
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

    setChromeVisible(!netflixMode);
    setImmersiveMode(true);

    try {
      const ok = await requestNativeFullscreen(videoRef);
      if (ok) {
        setIsFullscreen(true);
        setNativeFullscreen(isFullscreenWithinRoot(root));
        lockLandscapeOrientation().catch(() => {});
        return;
      }
    } catch {
      const video = videoRef?.current;
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        lockLandscapeOrientation().catch(() => {});
        return;
      }
    }

    activateCinemaMode();
    lockLandscapeOrientation().catch(() => {});
  }, [activateCinemaMode, cinemaMode, immersiveMode, isFullscreen, netflixMode, plyrInstanceRef]);

  const handleChromeInteractionStart = useCallback(() => {
    chromeInteractingRef.current = true;
    clearChromeHideTimer();
    setChromeVisible(true);
  }, [clearChromeHideTimer]);

  const handleChromeInteractionEnd = useCallback(() => {
    clearChromeHideTimer();
    window.setTimeout(() => {
      chromeInteractingRef.current = false;
      if (playing || isVideoImmersive) scheduleChromeHide();
    }, CHROME_INTERACTION_END_MS);
  }, [clearChromeHideTimer, isVideoImmersive, playing, scheduleChromeHide]);

  const resetChromeOnChapterChange = useCallback(() => {
    setChromeVisible(!netflixMode);
    if (!netflixMode) {
      setImmersiveMode(false);
    }
    clearChromeHideTimer();
  }, [clearChromeHideTimer, netflixMode]);

  return {
    chromeVisible,
    revealChrome,
    hideChrome,
    clearChromeHideTimer,
    isFullscreen,
    nativeFullscreen,
    immersiveMode,
    cinemaMode,
    videoImmersive,
    isVideoImmersive,
    cssFullscreen,
    bindImmersiveRoot,
    fullscreenRootRef,
    activateCinemaMode,
    requestFullscreen,
    handleChromeInteractionStart,
    handleChromeInteractionEnd,
    phoneLandscape,
    pipSupported,
    resetChromeOnChapterChange,
  };
}
