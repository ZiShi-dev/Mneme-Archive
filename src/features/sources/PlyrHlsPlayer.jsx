import React, { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Hls from "hls.js";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { createSourceStreamLoader } from "../../lib/hls/sourceStreamLoader";
import { createHlsPlayerConfig, prefersHighVideoQuality } from "../../lib/hls/hlsConfig";
import { applyHlsStartLevel, applyPlyrHlsQualityMenu } from "../../lib/hls/playbackQuality";
import { isChromebookApp } from "../../config/appFlavor";
import { useI18n } from "../../i18n/I18nProvider";

const LOAD_TIMEOUT_MS = 45_000;

const PLYR_FULLSCREEN_CONTAINER = ".live-video-immersive-root";

function getPlyrOptions(t) {
  return {
    autoplay: false,
    clickToPlay: true,
    hideControls: !isChromebookApp,
    resetOnEnd: false,
    keyboard: { focused: true, global: false },
    tooltips: { controls: true, seek: true },
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
    fullscreen: {
      enabled: true,
      fallback: Capacitor.isNativePlatform() ? "force" : true,
      iosNative: !isChromebookApp,
      container: PLYR_FULLSCREEN_CONTAINER,
    },
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "duration",
      "rewind",
      "fast-forward",
      "mute",
      "volume",
      "captions",
      "settings",
      "pip",
      "airplay",
      "fullscreen",
    ],
    i18n: {
      restart: t("reader.plyr.restart"),
      play: t("reader.plyr.play"),
      pause: t("reader.plyr.pause"),
      fastForward: t("reader.plyr.fastForward"),
      rewind: t("reader.plyr.rewind"),
      seek: t("reader.plyr.seek"),
      played: t("reader.plyr.played"),
      buffered: t("reader.plyr.buffered"),
      currentTime: t("reader.plyr.currentTime"),
      duration: t("reader.plyr.duration"),
      volume: t("reader.plyr.volume"),
      mute: t("reader.plyr.mute"),
      unmute: t("reader.plyr.unmute"),
      enableCaptions: t("reader.plyr.enableCaptions"),
      disableCaptions: t("reader.plyr.disableCaptions"),
      enterFullscreen: t("reader.plyr.enterFullscreen"),
      exitFullscreen: t("reader.plyr.exitFullscreen"),
      settings: t("reader.plyr.settings"),
      speed: t("reader.plyr.speed"),
      normal: t("reader.plyr.normal"),
      quality: t("reader.plyr.quality"),
      pip: t("reader.plyr.pip"),
    },
  };
}

function getPlyrVideo(apiRef) {
  const media = apiRef.current?.plyr?.media;
  return media instanceof HTMLVideoElement ? media : null;
}

export function PlyrHlsPlayer({
  src,
  poster = "",
  subtitles = [],
  subtitlesEnabled = true,
  loadingLabel,
  videoRef,
  className = "",
  onError,
  onReady,
  onPlyrInstance,
}) {
  const { t } = useI18n();
  const plyrOptions = useMemo(
    () => getPlyrOptions(t),
    [t, src],
  );
  const resolvedLoadingLabel = loadingLabel || t("reader.stream.loading");
  const plyrApiRef = useRef(null);
  const hlsRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const onPlyrInstanceRef = useRef(onPlyrInstance);
  const [failed, setFailed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [errorHint, setErrorHint] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [playerVersion, setPlayerVersion] = useState(0);

  onErrorRef.current = onError;
  onReadyRef.current = onReady;
  onPlyrInstanceRef.current = onPlyrInstance;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const waitForVideo = () => {
      if (cancelled) return;
      const video = getPlyrVideo(plyrApiRef);
      const plyr = plyrApiRef.current?.plyr;
      if (video) {
        if (videoRef) videoRef.current = video;
        onPlyrInstanceRef.current?.(plyr ?? null);
        setPlayerVersion((value) => value + 1);
        return;
      }
      attempts += 1;
      if (attempts < 60) {
        window.setTimeout(waitForVideo, 50);
      }
    };

    waitForVideo();
    return () => {
      cancelled = true;
      onPlyrInstanceRef.current?.(null);
    };
  }, [src, retryNonce, videoRef]);

  useEffect(() => {
    const videoEl = getPlyrVideo(plyrApiRef);
    if (!videoEl || !src) return undefined;

    let disposed = false;
    let loadTimeoutId = 0;
    let networkErrors = 0;
    let readyNotified = false;

    setFailed(false);
    setShowOverlay(true);
    setErrorHint("");

    const clearLoadTimeout = () => {
      if (loadTimeoutId) window.clearTimeout(loadTimeoutId);
      loadTimeoutId = 0;
    };

    const markFailed = (hint, error, notifyParent = true) => {
      if (disposed) return;
      clearLoadTimeout();
      setShowOverlay(false);
      setFailed(true);
      if (hint) setErrorHint(hint);
      if (notifyParent) {
        onErrorRef.current?.(error ?? new Error(hint || t("reader.stream.failedShort")));
      }
    };

    const markReady = () => {
      clearLoadTimeout();
      setShowOverlay(false);
      if (readyNotified) return;
      readyNotified = true;
      onReadyRef.current?.(videoEl);
    };

    loadTimeoutId = window.setTimeout(() => {
      markFailed(t("reader.stream.timeout"));
    }, LOAD_TIMEOUT_MS);

    if (!Hls.isSupported()) {
      markFailed(t("reader.stream.unsupported"));
      return () => {
        disposed = true;
        clearLoadTimeout();
      };
    }

    const isNative = Capacitor.isNativePlatform();
    const hls = new Hls(createHlsPlayerConfig({
      loader: isNative ? createSourceStreamLoader() : undefined,
    }));
    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (disposed) return;
      clearLoadTimeout();
      setShowOverlay(false);
      applyHlsStartLevel(hls, prefersHighVideoQuality());
      applyPlyrHlsQualityMenu(hls, plyrApiRef.current?.plyr);
    });
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (!disposed) markReady();
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (disposed || !data?.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        networkErrors += 1;
        if (networkErrors <= 6) {
          hls.startLoad(-1);
          return;
        }
        markFailed(t("reader.stream.connectFailed"), data);
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }

      markFailed(data.details || t("reader.stream.playerError"), data);
    });

    hls.attachMedia(videoEl);
    hls.loadSource(src);

    return () => {
      disposed = true;
      clearLoadTimeout();
      hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [src, retryNonce, playerVersion, t]);

  useEffect(() => {
    const videoEl = getPlyrVideo(plyrApiRef);
    if (!videoEl) return undefined;

    const tracks = [...videoEl.querySelectorAll("track")];
    tracks.forEach((track) => track.remove());

    subtitles.forEach((track, index) => {
      if (!track?.url) return;
      const element = document.createElement("track");
      element.kind = "subtitles";
      element.label = track.label || `Track ${index + 1}`;
      element.srclang = track.lang || "ar";
      element.src = track.url;
      element.default = index === 0;
      videoEl.appendChild(element);
    });

    [...videoEl.textTracks].forEach((textTrack) => {
      textTrack.mode = subtitlesEnabled ? "showing" : "hidden";
    });
  }, [subtitles, subtitlesEnabled, src, playerVersion]);

  function retry() {
    setFailed(false);
    setShowOverlay(true);
    setErrorHint("");
    setRetryNonce((value) => value + 1);
  }

  return (
    <div className={`live-video-player-frame plyr-hls-player${className ? ` ${className}` : ""}`}>
      <Plyr
        key={`${src}-${retryNonce}`}
        ref={plyrApiRef}
        source={null}
        options={plyrOptions}
        playsInline
        preload="auto"
        poster={poster || undefined}
        crossOrigin="anonymous"
      />
      {showOverlay && !failed && (
        <div className="live-video-player-overlay live-video-player-overlay--loading">
          {resolvedLoadingLabel}
        </div>
      )}
      {failed && (
        <div className="live-video-player-overlay">
          <p>{errorHint || t("reader.stream.failedShort")}</p>
          <small>{t("reader.stream.tryAnother")}</small>
          <button type="button" className="live-video-retry-button" onClick={retry}>
            {t("reader.stream.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
