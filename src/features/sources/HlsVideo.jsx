import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Hls from "hls.js";
import { createSourceStreamLoader } from "../../lib/hls/sourceStreamLoader";
import { createHlsPlayerConfig, getVideoPreloadMode } from "../../lib/hls/hlsConfig";
import { t } from "../../i18n/runtime.js";

const LOAD_TIMEOUT_MS = 45_000;

export function HlsVideo({
  src,
  subtitles = [],
  subtitlesEnabled = true,
  videoRef,
  className = "",
  onClick,
  onError,
  onReady,
  playsInline = true,
  preload = getVideoPreloadMode(),
}) {
  const hlsRef = useRef(null);
  const internalRef = useRef(null);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const [videoEl, setVideoEl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [errorHint, setErrorHint] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  onErrorRef.current = onError;
  onReadyRef.current = onReady;

  const assignVideoRef = useCallback((node) => {
    internalRef.current = node;
    if (videoRef) videoRef.current = node;
    setVideoEl(node);
  }, [videoRef]);

  useEffect(() => {
    if (!videoEl || !src) return undefined;

    let disposed = false;
    let loadTimeoutId = 0;
    let networkErrors = 0;
    let readyNotified = false;
    let userPaused = false;

    setFailed(false);
    setShowOverlay(true);
    setErrorHint("");

    const clearLoadTimeout = () => {
      if (loadTimeoutId) window.clearTimeout(loadTimeoutId);
      loadTimeoutId = 0;
    };

    const hideOverlay = () => {
      if (disposed) return;
      clearLoadTimeout();
      setShowOverlay(false);
    };

    const tryAutoplay = () => {
      if (disposed || userPaused) return;
      videoEl.play().catch(() => {});
    };

    const markReady = () => {
      hideOverlay();
      if (readyNotified) return;
      readyNotified = true;
      onReadyRef.current?.(videoEl);
    };

    const onPause = () => {
      if (videoEl.currentTime > 0) userPaused = true;
    };

    const onPlay = () => {
      userPaused = false;
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

    const syncFromVideo = () => {
      if (videoEl.duration > 0 || videoEl.readyState >= 2) hideOverlay();
      if (videoEl.readyState >= 3) markReady();
    };

    videoEl.addEventListener("loadedmetadata", syncFromVideo);
    videoEl.addEventListener("durationchange", syncFromVideo);
    videoEl.addEventListener("canplay", syncFromVideo);
    videoEl.addEventListener("playing", markReady);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("play", onPlay);

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
      hideOverlay();
      tryAutoplay();
    });
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (!disposed) markReady();
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (disposed || !data) return;
      if (!data.fatal) return;

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

    const pollId = window.setInterval(syncFromVideo, 500);

    return () => {
      disposed = true;
      clearLoadTimeout();
      window.clearInterval(pollId);
      videoEl.removeEventListener("loadedmetadata", syncFromVideo);
      videoEl.removeEventListener("durationchange", syncFromVideo);
      videoEl.removeEventListener("canplay", syncFromVideo);
      videoEl.removeEventListener("playing", markReady);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("play", onPlay);
      hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      videoEl.removeAttribute("src");
      videoEl.load();
    };
  }, [retryNonce, src, videoEl]);

  useEffect(() => {
    if (!videoEl) return undefined;

    const syncSubtitleTracks = () => {
      const captionTracks = [...videoEl.textTracks].filter(
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

    videoEl.addEventListener("loadedmetadata", syncSubtitleTracks);
    videoEl.addEventListener("addtrack", syncSubtitleTracks);
    syncSubtitleTracks();
    return () => {
      videoEl.removeEventListener("loadedmetadata", syncSubtitleTracks);
      videoEl.removeEventListener("addtrack", syncSubtitleTracks);
    };
  }, [retryNonce, subtitles, subtitlesEnabled, videoEl]);

  function retry() {
    setFailed(false);
    setShowOverlay(true);
    setErrorHint("");
    setRetryNonce((value) => value + 1);
  }

  return (
    <div className="live-video-player-frame">
      <video
        ref={assignVideoRef}
        className={className}
        playsInline={playsInline}
        preload={preload}
        controls={false}
        controlsList="nodownload noremoteplayback"
        onClick={onClick}
      >
        {subtitles.map((track) => (
          <track
            key={track.url}
            kind={track.kind || "subtitles"}
            src={track.url}
            srcLang={track.lang}
            label={track.label}
            default={track.default}
          />
        ))}
      </video>
      {showOverlay && !failed && (
        <div className="live-video-player-overlay live-video-player-overlay--loading">
          <p>{t("reader.stream.loading")}</p>
        </div>
      )}
      {failed && (
        <div className="live-video-player-overlay">
          <p>{t("reader.stream.failed")}</p>
          {errorHint && <small>{errorHint}</small>}
          <button type="button" className="live-video-retry-button" onClick={retry}>
            {t("reader.stream.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
