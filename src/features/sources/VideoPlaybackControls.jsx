import React from "react";
import {
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
  Server,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { useI18n } from "../../i18n/I18nProvider";
import { VideoServerPickerButton } from "./liveVideo/VideoServerPickerButton";
import { formatVideoChapterNavLabel } from "./mediaPresentation";

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

function chapterLabel(chapter, unitLabel) {
  if (!chapter) return "";
  return formatVideoChapterNavLabel(chapter, unitLabel);
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
  subtitlesAvailable = false,
  subtitlesEnabled = true,
  onToggleSubtitles,
  onSeek,
  onSeekEnd,
  onTogglePlay,
  onSkip,
  onCycleSpeed,
  onVolumeChange,
  onToggleMute,
  onPictureInPicture,
  previousChapter,
  nextChapter,
  onPrevious,
  onNext,
  onClose,
  onFullscreen,
  showServerPicker = false,
  currentServerLabel = "",
  onOpenServers,
  unitLabel,
  netflixMode = false,
  showCenterPlay = false,
  hideFullscreen = false,
  dockOnly = false,
  minimalOverlay = false,
  progressOnly = false,
  forceChapterNav = false,
  className = "",
  compact = false,
}) {
  const { t, dir } = useI18n();
  const resolvedUnitLabel = unitLabel || t("media.theEpisode");
  const showChapterNav = (forceChapterNav || Boolean(previousChapter || nextChapter)) && !minimalOverlay && !progressOnly;
  const minimalMode = navOnly || progressOnly;
  const showAuxTools = !navOnly && !minimalOverlay && !progressOnly;
  const showRemainingTime = netflixMode && minimalOverlay && duration > 0;
  const remainingTime = Math.max(0, duration - currentTime);
  const playbackClassName = [
    "reader-playback",
    "reader-playback--video",
    embedMode ? "reader-playback--embed" : "",
    compact ? "reader-playback--compact" : "",
    navOnly ? "reader-playback--nav-only" : "",
    netflixMode ? "reader-playback--netflix" : "",
    minimalOverlay ? "reader-playback--minimal" : "",
    progressOnly ? "reader-playback--progress-only" : "",
    showServerPicker ? "reader-playback--has-server" : "",
    showChapterNav ? "" : "reader-playback--no-nav",
    className,
  ].filter(Boolean).join(" ");

  function renderChapterButton(side, chapter, onClick, disabled) {
    const isPrev = side === "prev";
    const label = chapterLabel(chapter, resolvedUnitLabel);
    const isHeaderNav = className.includes("toolbar-nav");
    return (
      <button
        type="button"
        className={`reader-playback__chapter reader-playback__chapter--${side}${navOnly ? " reader-playback__chapter--dock" : ""}${isHeaderNav ? " reader-playback__chapter--header" : ""}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={t(isPrev ? "reader.playback.previousUnit" : "reader.playback.nextUnit", { unit: resolvedUnitLabel })}
      >
        {isPrev ? <ChevronLeft size={isHeaderNav ? 16 : (navOnly ? 18 : 19)} aria-hidden="true" /> : null}
        <span className="reader-playback__chapter-label">
          {navOnly ? (
            <b dir="auto">{label || (disabled ? "—" : "")}</b>
          ) : (
            <>
              <small>{t(isPrev ? "reader.playback.previousUnit" : "reader.playback.nextUnit", { unit: resolvedUnitLabel })}</small>
              {label ? <b dir="auto">{label}</b> : null}
            </>
          )}
        </span>
        {!isPrev ? <ChevronRight size={isHeaderNav ? 16 : (navOnly ? 18 : 19)} aria-hidden="true" /> : null}
      </button>
    );
  }

  function renderToolButtons() {
    return (
      <>
        {showServerPicker && !minimalOverlay && !navOnly && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={() => onOpenServers?.()}
            aria-label={t("reader.stream.openServers", { server: currentServerLabel || t("reader.stream.server") })}
          >
            <Server size={14} />
            <span dir="ltr">{currentServerLabel || t("reader.stream.server")}</span>
          </button>
        )}

        {!minimalMode && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={() => onCycleSpeed?.()}
            aria-label={t("reader.playback.playbackSpeed", { speed: formatSpeed(playbackRate) })}
          >
            <Gauge size={14} />
            <span>{formatSpeed(playbackRate)}</span>
          </button>
        )}

        {!minimalMode && (
          <div className="reader-playback__menu-volume">
            <button
              type="button"
              className="reader-playback__tool-btn"
              onClick={() => onToggleMute?.()}
              aria-label={muted || volume === 0 ? t("reader.playback.unmute") : t("reader.playback.mute")}
            >
              {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {!compact ? <span>{t("reader.playback.volumeLevel")}</span> : null}
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
            onClick={() => onToggleSubtitles?.()}
            aria-label={subtitlesEnabled ? t("reader.playback.hideSubtitles") : t("reader.playback.showSubtitles")}
            aria-pressed={subtitlesEnabled}
          >
            {subtitlesEnabled ? <Captions size={14} /> : <CaptionsOff size={14} />}
            <span>{t("reader.playback.subtitles")}</span>
          </button>
        )}

        {!minimalMode && pipSupported && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={() => onPictureInPicture?.()}
            aria-label={t("reader.playback.pictureInPicture")}
          >
            <PictureInPicture2 size={14} />
            <span>{t("reader.playback.pictureInPicture")}</span>
          </button>
        )}

        {!hideFullscreen && (
          <button
            type="button"
            className="reader-playback__tool-btn"
            onClick={() => onFullscreen?.()}
            aria-label={isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}</span>
          </button>
        )}
      </>
    );
  }

  if (progressOnly) {
    return (
      <section
        className={playbackClassName}
        dir={dir}
        aria-label={t("reader.playback.watchProgress")}
      >
        <div className="reader-playback__dock-progress">
          <Slider
            className="reader-playback__slider reader-playback__slider--dock-top"
            dir="ltr"
            aria-label={t("reader.playback.watchProgress")}
            value={progress}
            minValue={0}
            maxValue={100}
            onChange={onSeek}
            onChangeEnd={onSeekEnd ?? onSeek}
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
          <div className="reader-playback__dock-toolbar">
            <button
              type="button"
              className={`reader-playback__play reader-playback__play--dock ${playing ? "active is-playing" : ""}`}
              onClick={onTogglePlay}
              aria-label={playing ? t("reader.playback.pause") : t("reader.playback.play")}
            >
              {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>
            <span className="reader-playback__time reader-playback__time--dock" aria-hidden="true">
              <span className="reader-playback__time-current">{formatTime(currentTime)}</span>
              <span className="reader-playback__time-sep">/</span>
              <span className="reader-playback__time-duration">{formatTime(duration)}</span>
            </span>
            {!hideFullscreen && onFullscreen ? (
              <button
                type="button"
                className="reader-playback__icon-btn reader-playback__icon-btn--fullscreen"
                onClick={onFullscreen}
                aria-label={isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}
              >
                {isFullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (dockOnly) {
    const showDockTimeline = !navOnly || embedMode;
    if (navOnly && !showDockTimeline) return null;
    return (
      <section
        className={`reader-playback reader-playback--video reader-playback--dock${embedMode ? " reader-playback--embed" : ""}${navOnly ? " reader-playback--nav-only" : ""}${netflixMode ? " reader-playback--netflix" : ""}${showServerPicker ? " reader-playback--has-server" : ""}${showChapterNav ? "" : " reader-playback--no-nav"}${className ? ` ${className}` : ""}`}
        dir={dir}
        aria-label={t("reader.playback.watchUnit", { unit: resolvedUnitLabel })}
      >
        {showDockTimeline ? (
          <div className="reader-playback__timeline reader-playback__timeline--compact">
            <Slider
              className="reader-playback__slider"
              dir="ltr"
              aria-label={t("reader.playback.watchProgress")}
              value={progress}
              minValue={0}
              maxValue={100}
              onChange={onSeek}
            onChangeEnd={onSeekEnd ?? onSeek}
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
            <span className="reader-playback__time reader-playback__time--dock" aria-hidden="true">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={playbackClassName}
      dir={dir}
      aria-label={t("reader.playback.watchUnit", { unit: resolvedUnitLabel })}
    >
      {!minimalMode && (
        <div className="reader-playback__timeline">
          <span className="reader-playback__time reader-playback__time--current" aria-hidden="true">{formatTime(currentTime)}</span>
          <Slider
            className="reader-playback__slider"
            dir="ltr"
            aria-label={t("reader.playback.watchProgress")}
            value={progress}
            minValue={0}
            maxValue={100}
            onChange={onSeek}
            onChangeEnd={onSeekEnd ?? onSeek}
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
          <span
            className={`reader-playback__time${showRemainingTime ? " reader-playback__time--remaining" : ""}`}
            aria-hidden="true"
          >
            {showRemainingTime ? `-${formatTime(remainingTime)}` : formatTime(duration)}
          </span>
          {showClose && (
            <button type="button" className="reader-playback__close" onClick={onClose} aria-label={t("reader.playback.hideViewControls")}>
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {!navOnly ? (
      <div className="reader-playback__actions reader-playback__actions--primary">
        {showChapterNav && renderChapterButton("prev", previousChapter, onPrevious, !previousChapter)}

        {showServerPicker && !minimalOverlay ? (
          <VideoServerPickerButton
            compact
            label={currentServerLabel}
            onClick={onOpenServers}
            className="reader-playback__server-picker"
          />
        ) : null}

        {showCenterPlay && (
          <button
            type="button"
            className={`reader-playback__play reader-playback__play--center ${playing ? "active" : ""}`}
            onClick={onTogglePlay}
            aria-label={playing ? t("reader.playback.pause") : t("reader.playback.play")}
          >
            {playing ? <Pause size={21} /> : <Play size={21} />}
          </button>
        )}

        <div className="reader-playback__transport">
          {!minimalMode && (
            <button
              type="button"
              className="reader-playback__icon-btn reader-playback__icon-btn--skip"
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
              className={`reader-playback__play ${playing ? "active is-playing" : ""}`}
              onClick={onTogglePlay}
              aria-label={playing ? t("reader.playback.pause") : t("reader.playback.play")}
            >
              {playing ? <Pause size={22} /> : <Play size={22} />}
            </button>
          )}

          {!minimalMode && (
            <button
              type="button"
              className="reader-playback__icon-btn reader-playback__icon-btn--skip"
              onClick={() => onSkip?.(10)}
              aria-label={t("reader.playback.skipForward")}
            >
              <RotateCw size={16} />
              <span>10</span>
            </button>
          )}
        </div>

        {minimalOverlay && !embedMode && onPictureInPicture ? (
          <button
            type="button"
            className="reader-playback__icon-btn reader-playback__icon-btn--pip"
            onClick={() => onPictureInPicture?.()}
            aria-label={t("reader.playback.pictureInPicture")}
          >
            <PictureInPicture2 size={16} />
          </button>
        ) : null}

        {minimalOverlay && !hideFullscreen && onFullscreen ? (
          <button
            type="button"
            className="reader-playback__icon-btn reader-playback__icon-btn--fullscreen"
            onClick={() => onFullscreen?.()}
            aria-label={isFullscreen ? t("reader.playback.exitFullscreen") : t("reader.playback.enterFullscreen")}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        ) : null}

        {showChapterNav && renderChapterButton("next", nextChapter, onNext, !nextChapter)}
      </div>
      ) : null}

      {showAuxTools ? (
        <div className="reader-playback__actions reader-playback__actions--tools">
          {renderToolButtons()}
        </div>
      ) : null}
    </section>
  );
}
