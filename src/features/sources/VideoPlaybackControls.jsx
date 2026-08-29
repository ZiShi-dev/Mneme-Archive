import React, { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Captions,
  CaptionsOff,
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { useI18n } from "../../i18n/I18nProvider";

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatSpeed(rate = 1) {
  return Number.isInteger(rate) ? `${rate}×` : `${rate}×`;
}

export function VideoPlaybackControls({
  progress,
  buffered = 0,
  currentTime,
  duration,
  playing,
  embedMode = false,
  navOnly = false,
  showClose = true,
  playbackRate = 1,
  volume = 1,
  muted = false,
  pipSupported = false,
  isFullscreen = false,
  showMarkComplete = false,
  subtitlesAvailable = false,
  subtitlesEnabled = true,
  onToggleSubtitles,
  onSeek,
  onTogglePlay,
  onSkip,
  onCycleSpeed,
  onVolumeChange,
  onToggleMute,
  onPictureInPicture,
  onMarkComplete,
  previousChapter,
  nextChapter,
  onPrevious,
  onNext,
  onClose,
  onFullscreen,
  unitLabel,
  className = "",
  compact = false,
}) {
  const { t, dir } = useI18n();
  const resolvedUnitLabel = unitLabel || t("media.theEpisode");
  const [volumeOpen, setVolumeOpen] = useState(false);
  const showChapterNav = Boolean(previousChapter || nextChapter);
  const minimalMode = navOnly;

  return (
    <section
      className={`reader-playback reader-playback--video${compact ? " reader-playback--compact" : ""}${navOnly ? " reader-playback--nav-only" : ""}${showChapterNav ? "" : " reader-playback--no-nav"}${className ? ` ${className}` : ""}`}
      dir={dir}
      aria-label={t("reader.playback.watchUnit", { unit: resolvedUnitLabel })}
      onMouseLeave={() => setVolumeOpen(false)}
    >
      {!minimalMode && (
        <div className="reader-playback__timeline">
          <span className="reader-playback__time" aria-hidden="true">{formatTime(currentTime)}</span>
          <Slider
            className="reader-playback__slider"
            dir="ltr"
            aria-label={t("reader.playback.watchProgress")}
            value={progress}
            minValue={0}
            maxValue={100}
            onChange={onSeek}
          >
            <SliderTrack className="reader-playback__track">
              {({ state }) => (
                <>
                  <span
                    className="reader-playback__track-buffered"
                    style={{ width: `${Math.max(0, Math.min(100, buffered))}%` }}
                  />
                  <span style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
                  <SliderThumb className="reader-playback__thumb" />
                </>
              )}
            </SliderTrack>
          </Slider>
          <span className="reader-playback__time" aria-hidden="true">{formatTime(duration)}</span>
          {showClose && (
            <button type="button" className="reader-playback__close" onClick={onClose} aria-label={t("reader.playback.hideViewControls")}>
              <X size={15} />
            </button>
          )}
        </div>
      )}

      <div className={`reader-playback__actions reader-playback__actions--primary${navOnly ? " reader-playback__actions--nav-only" : ""}`}>
        {showChapterNav && (
          <button
            type="button"
            className={`reader-playback__chapter reader-playback__chapter--prev${navOnly ? " reader-playback__chapter--icon-only" : ""}`}
            onClick={onPrevious}
            disabled={!previousChapter}
            aria-label={t("reader.playback.previousUnit", { unit: resolvedUnitLabel })}
          >
            <ChevronLeft size={19} aria-hidden="true" />
            {!navOnly && (
              <span>
                <small>{t("reader.playback.previousUnit", { unit: resolvedUnitLabel })}</small>
                {!compact && previousChapter && <b dir="auto">{previousChapter.name || previousChapter.number}</b>}
              </span>
            )}
          </button>
        )}

        {!minimalMode && (
          <button
            type="button"
            className="reader-playback__icon-btn"
            onClick={() => onSkip?.(-10)}
            aria-label={t("reader.playback.skipBack")}
          >
            <RotateCcw size={16} />
            <span>10</span>
          </button>
        )}

        {!minimalMode && (
          <button
            type="button"
            className={`reader-playback__play ${playing ? "active" : ""}`}
            onClick={onTogglePlay}
            aria-label={playing ? t("reader.playback.pause") : t("reader.playback.play")}
          >
            {playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
        )}

        {!minimalMode && (
          <button
            type="button"
            className="reader-playback__icon-btn"
            onClick={() => onSkip?.(10)}
            aria-label={t("reader.playback.skipForward")}
          >
            <RotateCw size={16} />
            <span>10</span>
          </button>
        )}

        {showChapterNav && (
          <button
            type="button"
            className={`reader-playback__chapter reader-playback__chapter--next${navOnly ? " reader-playback__chapter--icon-only" : ""}`}
            onClick={onNext}
            disabled={!nextChapter}
            aria-label={t("reader.playback.nextUnit", { unit: resolvedUnitLabel })}
          >
            {!navOnly && (
              <span>
                <small>{t("reader.playback.nextUnit", { unit: resolvedUnitLabel })}</small>
                {!compact && nextChapter && <b dir="auto">{nextChapter.name || nextChapter.number}</b>}
              </span>
            )}
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        )}

        {navOnly && (
          <button
            type="button"
            className="reader-playback__tool-btn reader-playback__tool-btn--center"
            onClick={onFullscreen}
            aria-label={isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>

      <div className={`reader-playback__actions reader-playback__actions--tools${navOnly ? " reader-playback__actions--hidden" : ""}`}>
        {!minimalMode && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={onCycleSpeed}
            aria-label={t("reader.playback.playbackSpeed", { speed: formatSpeed(playbackRate) })}
          >
            <Gauge size={14} />
            {!compact && <span>{formatSpeed(playbackRate)}</span>}
          </button>
        )}

        {!minimalMode && (
          <div
            className={`reader-playback__volume${volumeOpen ? " is-open" : ""}`}
            onMouseEnter={() => setVolumeOpen(true)}
          >
            <button
              type="button"
              className="reader-playback__tool-btn"
              onClick={onToggleMute}
              aria-label={muted || volume === 0 ? t("reader.playback.unmute") : t("reader.playback.mute")}
            >
              {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <input
              type="range"
              className="reader-playback__volume-slider"
              min="0"
              max="100"
              step="1"
              value={muted ? 0 : Math.round(volume * 100)}
              onChange={(event) => onVolumeChange?.(Number(event.target.value) / 100)}
              aria-label={t("reader.playback.volumeLevel")}
            />
          </div>
        )}

        {!minimalMode && subtitlesAvailable && (
          <button
            type="button"
            className={`reader-playback__tool-btn${subtitlesEnabled ? " reader-playback__tool-btn--accent" : ""}`}
            onClick={onToggleSubtitles}
            aria-label={subtitlesEnabled ? t("reader.playback.hideSubtitles") : t("reader.playback.showSubtitles")}
            aria-pressed={subtitlesEnabled}
          >
            {subtitlesEnabled ? <Captions size={14} /> : <CaptionsOff size={14} />}
            {!compact && <span>{t("reader.playback.subtitles")}</span>}
          </button>
        )}

        {!minimalMode && pipSupported && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={onPictureInPicture}
            aria-label={t("reader.playback.pictureInPicture")}
          >
            <PictureInPicture2 size={14} />
          </button>
        )}

        {!navOnly && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={onFullscreen}
          aria-label={isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}

        {!minimalMode && showMarkComplete && (
          <button
            type="button"
            className="reader-playback__tool-btn reader-playback__tool-btn--accent"
            onClick={onMarkComplete}
            aria-label={t("reader.playback.markComplete")}
          >
            <Check size={14} />
            {!compact && <span>{t("reader.playback.completed")}</span>}
          </button>
        )}
      </div>
    </section>
  );
}
