import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { lockLandscapeOrientation, unlockOrientation } from "../../../lib/video/orientationLock";
import { isChromebookApp } from "../../../config/appFlavor";
import { installEmbedPopupGuards } from "../../../lib/video/embedHosts";
import { CHROME_IDLE_MS, FULLSCREEN_CHROME_IDLE_MS } from "./constants";

export function useVideoCinemaChrome({
  playback,
  embedMode,
  usePlyrPlayer,
  playing,
  plyrInstance,
  plyrInstanceRef,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [phoneLandscape, setPhoneLandscape] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const fullscreenRootRef = useRef(null);
  const chromeHideTimerRef = useRef(0);
  const chromeInteractingRef = useRef(false);

  const plyrFullscreenActive = Boolean(plyrInstance?.fullscreen?.active);
  const cinemaMode = Boolean(
    playback
    && (immersiveMode || isFullscreen || plyrFullscreenActive),
  );
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
    setChromeVisible(true);
    setImmersiveMode(true);
    setIsFullscreen(true);
    syncCinemaDom(true);
  }, [syncCinemaDom]);

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

  async function requestNativeFullscreen(videoRef) {
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

    const video = videoRef?.current;
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return true;
    }

    return false;
  }

  const requestFullscreen = useCallback(async (videoRef) => {
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
      const ok = await requestNativeFullscreen(videoRef);
      if (ok) {
        setIsFullscreen(true);
        setNativeFullscreen(Boolean(getFullscreenElement()));
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
  }, [activateCinemaMode, cinemaMode, immersiveMode, isFullscreen, plyrInstanceRef]);

  const handleChromeInteractionStart = useCallback(() => {
    chromeInteractingRef.current = true;
    clearChromeHideTimer();
    setChromeVisible(true);
  }, [clearChromeHideTimer]);

  const handleChromeInteractionEnd = useCallback(() => {
    chromeInteractingRef.current = false;
    if (playing || cinemaMode) scheduleChromeHide();
  }, [cinemaMode, playing, scheduleChromeHide]);

  const resetChromeOnChapterChange = useCallback(() => {
    setChromeVisible(true);
    setImmersiveMode(false);
    clearChromeHideTimer();
  }, [clearChromeHideTimer]);

  return {
    chromeVisible,
    revealChrome,
    hideChrome,
    clearChromeHideTimer,
    isFullscreen,
    nativeFullscreen,
    immersiveMode,
    cinemaMode,
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
