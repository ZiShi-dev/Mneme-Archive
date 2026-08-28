import React from "react";
import { ChevronLeft, ChevronRight, Gauge, Pause, Play, X } from "lucide-react";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components";
import { useI18n } from "../../i18n/I18nProvider";

export function ReaderPlaybackControls({ progress, onSeek, autoScroll, onToggleAutoScroll, speed, onCycleSpeed, previousChapter, nextChapter, onPrevious, onNext, onClose }) {
  const { t } = useI18n();

  return (
    <section className="reader-playback" aria-label={t("reader.playback.chapterFollow")}>
      <div className="reader-playback__timeline">
        <span>{progress}%</span>
        <Slider className="reader-playback__slider" dir="ltr" aria-label={t("reader.playback.readProgress")} value={progress} minValue={0} maxValue={100} onChange={onSeek}>
          <SliderTrack className="reader-playback__track">{({ state }) => <><span style={{ width: `${state.getThumbPercent(0) * 100}%` }} /><SliderThumb className="reader-playback__thumb" /></>}</SliderTrack>
        </Slider>
        <button className="reader-playback__close" onClick={onClose} aria-label={t("reader.playback.hideControls")}><X size={15} /></button>
      </div>
      <div className="reader-playback__actions">
        <button className="reader-playback__chapter" onClick={onPrevious} disabled={!previousChapter} aria-label={t("reader.playback.previousChapter")}>
          <ChevronRight size={19} />
          <span><small>{t("reader.playback.previousLabel")}</small>{previousChapter && <b dir="auto">{previousChapter.name || previousChapter.number}</b>}</span>
        </button>
        <button className={`reader-playback__play ${autoScroll ? "active" : ""}`} onClick={onToggleAutoScroll} aria-label={autoScroll ? t("reader.playback.stopAutoScroll") : t("reader.playback.startAutoScroll")}>{autoScroll ? <Pause size={21} /> : <Play size={21} />}</button>
        <button className="reader-playback__chapter reader-playback__chapter--next" onClick={onNext} disabled={!nextChapter} aria-label={t("reader.playback.nextChapter")}>
          <span><small>{t("reader.playback.nextLabel")}</small>{nextChapter && <b dir="auto">{nextChapter.name || nextChapter.number}</b>}</span>
          <ChevronLeft size={19} />
        </button>
        <button className="reader-playback__speed" onClick={onCycleSpeed} aria-label={t("reader.playback.scrollSpeed", { speed })}><Gauge size={15} /><span>{speed}×</span></button>
      </div>
    </section>
  );
}
