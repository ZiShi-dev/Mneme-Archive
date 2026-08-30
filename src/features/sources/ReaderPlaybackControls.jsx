import React from "react";
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, X } from "lucide-react";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { useI18n } from "../../i18n/I18nProvider";
import { ReaderPlaybackChapterSkeleton } from "../../components/ui/ContentSkeleton";

export function ReaderPlaybackControls({
  progress,
  onSeek,
  autoScroll,
  onToggleAutoScroll,
  speed,
  onCycleSpeed,
  previousChapter,
  nextChapter,
  chaptersLoading = false,
  onPrevious,
  onNext,
  onClose,
}) {
  const { t, dir } = useI18n();

  return (
    <section className="reader-playback" dir={dir} aria-label={t("reader.playback.chapterFollow")}>
      <div className="reader-playback__timeline">
        <span>{progress}%</span>
        <Slider className="reader-playback__slider" dir="ltr" aria-label={t("reader.playback.readProgress")} value={progress} minValue={0} maxValue={100} onChange={onSeek}>
          <SliderTrack className="reader-playback__track">{({ state }) => <><span style={{ width: `${state.getThumbPercent(0) * 100}%` }} /><SliderThumb className="reader-playback__thumb" /></>}</SliderTrack>
        </Slider>
        <button className="reader-playback__close" onClick={onClose} aria-label={t("reader.playback.hideControls")}><X size={15} /></button>
      </div>
      <div className="reader-playback__actions">
        <button type="button" className={`reader-playback__chapter reader-playback__chapter--prev${chaptersLoading ? " is-loading" : ""}`} onClick={onPrevious} disabled={chaptersLoading || !previousChapter} aria-label={t("reader.playback.previousChapter")} aria-busy={chaptersLoading}>
          <ChevronLeft size={19} aria-hidden="true" />
          <span>
            <small>{t("reader.playback.previousLabel")}</small>
            {chaptersLoading ? <ReaderPlaybackChapterSkeleton /> : previousChapter && <b dir="auto">{previousChapter.name || previousChapter.number}</b>}
          </span>
        </button>
        <button type="button" className={`reader-playback__play ${autoScroll ? "active" : ""}`} onClick={onToggleAutoScroll} aria-label={autoScroll ? t("reader.playback.stopAutoScroll") : t("reader.playback.startAutoScroll")}>{autoScroll ? <Pause size={21} /> : <Play size={21} />}</button>
        <button type="button" className={`reader-playback__chapter reader-playback__chapter--next${chaptersLoading ? " is-loading" : ""}`} onClick={onNext} disabled={chaptersLoading || !nextChapter} aria-label={t("reader.playback.nextChapter")} aria-busy={chaptersLoading}>
          <span>
            <small>{t("reader.playback.nextLabel")}</small>
            {chaptersLoading ? <ReaderPlaybackChapterSkeleton /> : nextChapter && <b dir="auto">{nextChapter.name || nextChapter.number}</b>}
          </span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
        <button type="button" className="reader-playback__speed" onClick={onCycleSpeed} aria-label={t("reader.playback.scrollSpeed", { speed })}><Gauge size={15} /><span>{speed}×</span></button>
      </div>
    </section>
  );
}
