import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Bookmark, Check, ChevronLeft, Menu, MoreHorizontal, Settings2 } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { useI18n } from "../i18n/I18nProvider";
import { burstSakuraFrom } from "../lib/sakura/burst";
import { resolveSourceId } from "../config/sources";
import { ReadingContinueCard } from "../features/sources/ReadingContinueCard";
import { useChapterCompletion } from "../hooks/useChapterCompletion";
import {
  computeReaderScrollProgress,
  findChapterByRecord,
  getChapterScrollKey,
} from "../lib/readingProgress";
import { getChapterProgress, setChapterProgress } from "../lib/storage/chapterProgress";
import { SectionTitle } from "../components/layout/SectionTitle";
import { Cover } from "../components/manga/Cover";

export function MangaDetails({ item, isFavorite, toggleFavorite, onBack, openReader, readingProgress }) {
  const { t } = useI18n();
  const chapterEntries = useMemo(
    () => Array.from({ length: 9 }, (_, index) => {
      const number = item.chapters - index;
      return { number, name: String(number), url: `demo-chapter:${number}` };
    }),
    [item.chapters],
  );
  const continueChapter = findChapterByRecord(chapterEntries, readingProgress);

  function openChapter(chapterNumber) {
    openReader(item, chapterNumber);
  }

  return (
    <div className="screen screen--details">
      <div className={`details-hero details-hero--${item.accent}`}>
        <div className="details-hero__nav">
          <button className="icon-button icon-button--glass" onClick={onBack}><ArrowRight size={20} /></button>
          <button className="icon-button icon-button--glass"><MoreHorizontal size={21} /></button>
        </div>
        <div className="details-hero__content">
          <Cover item={item} large />
          <div className="details-hero__meta">
            <span className="pill pill--light">{item.status}</span>
            <h1 className="details-hero__title" dir="auto">{item.title}</h1>
            <p className="details-hero__subtitle" dir="auto">{item.subtitle}</p>
            <small dir="ltr">{item.source}</small>
          </div>
        </div>
      </div>
      <main className="content details-content">
        {readingProgress && continueChapter && (
          <ReadingContinueCard
            record={readingProgress}
            chapter={continueChapter}
            onContinue={() => openChapter(continueChapter.number)}
          />
        )}

        <div className="details-actions">
          <button className="button button--primary" onClick={() => openReader(item)}>
            <BookOpen size={18} /> {t("demo.readChapter", { n: item.lastChapter })}
          </button>
          <button
            className={`button button--square ${isFavorite ? "is-favorite" : ""}`}
            onClick={(event) => { if (!isFavorite) burstSakuraFrom(event.currentTarget); toggleFavorite(item.id); }}
            aria-label={isFavorite ? t("reader.header.removeFavorite") : t("reader.header.addFavorite")}
            aria-pressed={isFavorite}
          >
            <Bookmark size={20} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="stat-row">
          <div><strong>{item.chapters}</strong><span>{t("demo.chaptersTitle")}</span></div>
          <div><strong>{readingProgress?.progress ?? item.progress}%</strong><span>{t("demo.progress")}</span></div>
          <div><strong>4.8</strong><span>{t("demo.rating")}</span></div>
        </div>

        <section className="about"><h2>{t("details.aboutWork")}</h2><p>{item.description}</p></section>
        <SectionTitle title={t("demo.chaptersTitle")} action={t("demo.sort")} />
        <div className="chapter-list">
          {chapterEntries.map((chapter, index) => (
            <button className="chapter-row" key={chapter.number} onClick={() => openChapter(chapter.number)}>
              <span className={`chapter-number ${index > 2 ? "chapter-number--read" : ""}`}>{index > 2 ? <Check size={16} /> : chapter.number}</span>
              <span>
                <strong>{t("demo.chapterLabel", { n: chapter.number })}</strong>
                <small>{index === 0 ? t("demo.newRecent") : t("history.daysAgo", { n: index + 1 })}</small>
              </span>
              {index === 0 && <span className="new-badge">{t("common.new")}</span>}
              <ChevronLeft size={18} />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export function Reader({ item, chapter, onBack, setProgress, onSaveProgress }) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const activeChapter = useMemo(() => ({
    number: chapter,
    name: String(chapter),
    url: `demo-chapter:${chapter}`,
  }), [chapter]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const progressKey = getChapterScrollKey(resolveSourceId(item), activeChapter.url);

  const handleChapterComplete = useCallback(() => {
    setScrollProgress(100);
    setChapterProgress(resolveSourceId(item), activeChapter.url, 100);
    onSaveProgress?.(item, activeChapter, 100, { completed: true });
    pushToast({ type: "success", message: t("demo.chapterComplete") });
  }, [activeChapter, item, onSaveProgress, pushToast, t]);

  const { completedRef } = useChapterCompletion({
    enabled: true,
    scrollProgress,
    progressKey,
    onComplete: handleChapterComplete,
    rootSelector: ".reader .chapter-end",
  });

  useEffect(() => {
    const saved = getChapterProgress(resolveSourceId(item), activeChapter.url);
    setScrollProgress(saved > 0 && saved < 100 ? saved : 0);
    window.scrollTo(0, 0);
  }, [chapter, progressKey]);

  useEffect(() => {
    const updateProgress = () => {
      setScrollProgress(computeReaderScrollProgress());
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [chapter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setChapterProgress(resolveSourceId(item), activeChapter.url, scrollProgress);
      if (onSaveProgress && scrollProgress > 0 && !completedRef.current) {
        onSaveProgress(item, activeChapter, scrollProgress, { completed: false });
      }
      setProgress(scrollProgress);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeChapter, item, onSaveProgress, progressKey, scrollProgress, setProgress]);

  const pageEstimate = Math.max(1, Math.round((scrollProgress / 100) * 38));

  return (
    <div className="reader">
      <header className="reader-header">
        <button onClick={onBack}><ArrowRight size={21} /></button>
        <div><strong>{item.title}</strong><span>{t("demo.chapterLabel", { n: chapter })}</span></div>
        <button><Menu size={21} /></button>
      </header>
      <div className="reader-pages">
        {Array.from({ length: 5 }, (_, index) => (
          <div className={`reader-page reader-page--${item.accent}`} key={index}>
            <div className="reader-page__moon" />
            <div className="reader-page__figure" />
            <div className="reader-page__landscape" />
            <span>{t("demo.page", { n: index + 1 })}</span>
          </div>
        ))}
        <div className="chapter-end">
          <Check size={25} />
          <h2>{t("demo.chapterEnd", { n: chapter })}</h2>
          <button className="button button--primary">{t("demo.nextChapter")} <ChevronLeft size={18} /></button>
        </div>
      </div>
      <div className="reader-progress"><span>{pageEstimate} / 38</span><div><i style={{ width: `${scrollProgress}%` }} /></div><button><Settings2 size={18} /></button></div>
    </div>
  );
}
