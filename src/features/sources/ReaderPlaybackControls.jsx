import React from "react";
import { ChevronLeft, ChevronRight, Gauge, List, Pause, Play, Settings2, X } from "lucide-react";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { useI18n } from "../../i18n/I18nProvider";
import { ReaderPlaybackChapterSkeleton } from "../../components/ui/ContentSkeleton";
import { ChapterLabel } from "./liveReader/ChapterLabel";
import { formatChapterHeaderLabel, splitChapterHeaderLabel } from "./mediaPresentation";

function resolveActiveChapterNumber(chapter, unitLabel) {
  if (!chapter) return null;
  const formatted = formatChapterHeaderLabel(chapter, unitLabel);
  const parts = splitChapterHeaderLabel(formatted);
  if (parts?.number) return parts.number;
  const raw = chapter.number || chapter.name;
  return raw ? String(raw).trim() : null;
}

function ReaderProgressTimeline({
  progress,
  onSeek,
  onSeekEnd,
  compact = false,
  dock = false,
  className = "",
  children = null,
}) {
  const { t } = useI18n();
  const displayProgress = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)));

  return (
    <div
      className={[
        "reader-playback__timeline",
        compact ? "reader-playback__timeline--compact" : "",
        dock ? "reader-playback__timeline--dock" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {!dock ? (
        <div
          className="reader-playback__progress-badge"
          aria-label={t("reader.playback.readProgress")}
          title={`${displayProgress}%`}
        >
          <strong>{displayProgress}</strong>
          <small>%</small>
        </div>
      ) : null}
      {dock ? (
        <span className="reader-playback__progress-value" aria-hidden="true">{displayProgress}%</span>
      ) : null}
      <Slider
        className="reader-playback__slider"
        dir="ltr"
        aria-label={t("reader.playback.readProgress")}
        value={displayProgress}
        minValue={0}
        maxValue={100}
        onChange={onSeek}
        onChangeEnd={onSeekEnd ?? onSeek}
      >
        <SliderTrack className="reader-playback__track">
          {({ state }) => (
            <>
              <span style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
              <SliderThumb className="reader-playback__thumb" />
            </>
          )}
        </SliderTrack>
      </Slider>
      {children}
    </div>
  );
}

export function ReaderPlaybackControls({
  progress,
  onSeek,
  autoScroll,
  onToggleAutoScroll,
  speed,
  onCycleSpeed,
  previousChapter,
  nextChapter,
  activeChapter = null,
  chaptersLoading = false,
  chapterCount = 0,
  onPrevious,
  onNext,
  onOpenChapterList,
  onOpenSettings,
  showSettings = false,
  settingsOpen = false,
  onClose,
  dockOnly = false,
  unitLabel,
}) {
  const { t, dir } = useI18n();
  const activeChapterNumber = resolveActiveChapterNumber(activeChapter, unitLabel);

  if (dockOnly) {
    return (
      <section
        className="reader-playback reader-playback--toolbar-dock"
        dir={dir}
        aria-label={t("reader.playback.chapterFollow")}
      >
        <ReaderProgressTimeline progress={progress} onSeek={onSeek} onSeekEnd={onSeek} compact dock />
        <div className="reader-playback__actions reader-playback__actions--dock">
          <div className="reader-playback__chrome" role="group" aria-label={t("reader.header.readingTools")}>
            {showSettings ? (
              <button
                type="button"
                className={`reader-playback__chrome-action${settingsOpen ? " is-active" : ""}`}
                onClick={onOpenSettings}
                aria-label={t("reader.header.displaySettings")}
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
              >
                <Settings2 size={15} strokeWidth={2.25} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="reader-playback__transport" role="group" aria-label={t("reader.playback.chapterFollow")}>
            <button
              type="button"
              className={`reader-playback__nav reader-playback__nav--prev${chaptersLoading ? " is-loading" : ""}`}
              onClick={onPrevious}
              disabled={chaptersLoading || !previousChapter}
              aria-label={t("reader.playback.previousChapter")}
              aria-busy={chaptersLoading}
            >
              <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`reader-playback__play reader-playback__play--dock ${autoScroll ? "active" : ""}`}
              onClick={onToggleAutoScroll}
              aria-label={autoScroll ? t("reader.playback.stopAutoScroll") : t("reader.playback.startAutoScroll")}
            >
              {autoScroll ? <Pause size={22} strokeWidth={2.25} /> : <Play size={22} strokeWidth={2.25} />}
            </button>
            <button
              type="button"
              className={`reader-playback__nav reader-playback__nav--next${chaptersLoading ? " is-loading" : ""}`}
              onClick={onNext}
              disabled={chaptersLoading || !nextChapter}
              aria-label={t("reader.playback.nextChapter")}
              aria-busy={chaptersLoading}
            >
              <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
          <div className="reader-playback__tools" role="group" aria-label={t("reader.playback.chapterFollow")}>
            <button
              type="button"
              className="reader-playback__tool reader-playback__tool--list"
              onClick={onOpenChapterList}
              disabled={chaptersLoading && chapterCount < 1}
              aria-label={t("reader.playback.openChapterList")}
            >
              <List size={16} strokeWidth={2.25} aria-hidden="true" />
              {activeChapterNumber ? (
                <span className="reader-playback__tool-chapter" dir="ltr">{activeChapterNumber}</span>
              ) : null}
            </button>
            <button type="button" className="reader-playback__tool reader-playback__tool--speed" onClick={onCycleSpeed} aria-label={t("reader.playback.scrollSpeed", { speed })}>
              <Gauge size={16} strokeWidth={2.25} aria-hidden="true" />
              <span>{speed}×</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="reader-playback" dir={dir} aria-label={t("reader.playback.chapterFollow")}>
      <ReaderProgressTimeline progress={progress} onSeek={onSeek} onSeekEnd={onSeek}>
        <button className="reader-playback__close" onClick={onClose} aria-label={t("reader.playback.hideControls")}><X size={15} /></button>
      </ReaderProgressTimeline>
      <div className="reader-playback__actions">
        <button type="button" className={`reader-playback__chapter reader-playback__chapter--prev${chaptersLoading ? " is-loading" : ""}`} onClick={onPrevious} disabled={chaptersLoading || !previousChapter} aria-label={t("reader.playback.previousChapter")} aria-busy={chaptersLoading}>
          <ChevronLeft size={19} aria-hidden="true" />
          <span>
            <small>{t("reader.playback.previousLabel")}</small>
            {chaptersLoading ? <ReaderPlaybackChapterSkeleton /> : previousChapter ? <ChapterLabel chapter={previousChapter} unitLabel={unitLabel} /> : null}
          </span>
        </button>
        <button type="button" className={`reader-playback__play ${autoScroll ? "active" : ""}`} onClick={onToggleAutoScroll} aria-label={autoScroll ? t("reader.playback.stopAutoScroll") : t("reader.playback.startAutoScroll")}>{autoScroll ? <Pause size={21} /> : <Play size={21} />}</button>
        <button type="button" className={`reader-playback__chapter reader-playback__chapter--next${chaptersLoading ? " is-loading" : ""}`} onClick={onNext} disabled={chaptersLoading || !nextChapter} aria-label={t("reader.playback.nextChapter")} aria-busy={chaptersLoading}>
          <span>
            <small>{t("reader.playback.nextLabel")}</small>
            {chaptersLoading ? <ReaderPlaybackChapterSkeleton /> : nextChapter ? <ChapterLabel chapter={nextChapter} unitLabel={unitLabel} /> : null}
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="reader-playback__list"
          onClick={onOpenChapterList}
          disabled={chaptersLoading && chapterCount < 1}
          aria-label={t("reader.playback.openChapterList")}
        >
          <List size={15} aria-hidden="true" />
          {activeChapterNumber ? (
            <span className="reader-playback__tool-chapter" dir="ltr">{activeChapterNumber}</span>
          ) : (
            chapterCount > 0 ? <span>{chapterCount}</span> : null
          )}
        </button>
        <button type="button" className="reader-playback__speed" onClick={onCycleSpeed} aria-label={t("reader.playback.scrollSpeed", { speed })}><Gauge size={15} /><span>{speed}×</span></button>
      </div>
    </section>
  );
}
