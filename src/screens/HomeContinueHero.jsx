import React from "react";
import { BookOpen, ChevronLeft, Clapperboard } from "lucide-react";
import { getSourceProfile, getSourceDisplayName } from "../config/sources";
import { Cover } from "../components/manga/Cover";
import { RemoteCover, SourceLogo } from "../features/sources";
import { resolveBookmarkType } from "../features/sources/contentTypes";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { useI18n } from "../i18n/I18nProvider";
import {
  formatRelativeReadingTime,
  getRecordProgress,
  isRecordCompleted,
} from "../lib/readingProgress";

function formatHeroSubtitle(record) {
  const subtitle = String(record?.altTitle || "").trim();
  if (!subtitle) return "";
  if (/VF\+VOSTFR|VOSTFR\+VF/i.test(subtitle.replace(/\s/g, ""))) return "";
  return subtitle;
}

function getChapterDisplay(record, t) {
  const type = resolveBookmarkType(record);
  if (type === "movie") {
    return { badge: t("home.film"), name: "" };
  }
  if (type === "anime" || type === "series") {
    const label = record.chapterNumber || record.chapterName || "؟";
    return { badge: t("home.episode", { label }), name: "" };
  }
  const number = record.chapterNumber;
  const name = record.chapterName;
  const badge = t("home.chapter", { label: number || name || "؟" });
  const showName = Boolean(name && String(name) !== String(number));
  return { badge, name: showName ? name : "" };
}

export function HomeContinueHero({
  entry,
  typeLabel,
  isVideoContinue,
  onContinue,
  onDiscover,
  emptyTypeLabel,
  emptyDescription,
  emptyActionLabel,
}) {
  const { t } = useI18n();
  const ContinueIcon = isVideoContinue ? Clapperboard : BookOpen;

  if (!entry) {
    return (
      <section className="hero-card hero-card--empty">
        <div className="hero-card__glow hero-card__glow--empty" aria-hidden="true" />
        <div className="hero-card__copy">
          <span className="hero-card__pill">
            <BookOpen size={13} aria-hidden="true" />
            <span>{emptyTypeLabel}</span>
          </span>
          <h2>{t("home.emptyTitle")}</h2>
          <p>{emptyDescription}</p>
          <button type="button" className="button button--dark hero-card__cta" onClick={onDiscover}>
            <BookOpen size={17} />
            {emptyActionLabel}
          </button>
        </div>
      </section>
    );
  }

  const { record, target } = entry;
  const profile = getSourceProfile(record.sourceId);
  const progress = getRecordProgress(record);
  const completed = isRecordCompleted(record);
  const { badge, name: chapterName } = getChapterDisplay(record, t);
  const mediaType = resolveBookmarkType(record);
  const subtitle = formatHeroSubtitle(record);

  return (
    <section
      className="hero-card hero-card--continue"
      onClick={onContinue}
      onKeyDown={(event) => { if (event.key === "Enter") onContinue(); }}
      role="button"
      tabIndex={0}
      aria-label={t("home.continueTitle", { title: record.title })}
    >
      <div className="hero-card__glow" aria-hidden="true" />

      <div className="hero-card__visual" aria-hidden="true">
        {target.kind === "demo" ? (
          <Cover item={target.item} large />
        ) : (
          <RemoteCover
            className="hero-card__image"
            src={record.cover}
            title={record.title}
            sourceId={record.sourceId}
            video={isVideoMediaType(mediaType)}
            novel={mediaType === "novel"}
            priority
          />
        )}
        <span className="hero-card__cover-shade" />
      </div>

      <div className="hero-card__copy">
        <div className="hero-card__top">
          <span className="hero-card__pill">
            <ContinueIcon size={13} aria-hidden="true" />
            <span>{typeLabel} · {isVideoContinue ? t("home.continueWatch") : t("home.continueRead")}</span>
          </span>
          {record.lastReadAt && (
            <time className="hero-card__time" dateTime={record.lastReadAt}>
              {formatRelativeReadingTime(record.lastReadAt)}
            </time>
          )}
        </div>

        <h2 dir="auto">{record.title}</h2>
        {subtitle && <p className="hero-card__subtitle" dir="auto">{subtitle}</p>}

        <div className="hero-card__chapter">
          <span className="hero-card__chapter-badge">{badge}</span>
          {chapterName && <span className="hero-card__chapter-name" dir="auto">{chapterName}</span>}
        </div>

        <div className="hero-card__progress-wrap">
          <span className="hero-card__progress-label">
            {completed ? (mediaType === "anime" ? t("home.completedFemale") : t("home.completed")) : `${progress}%`}
          </span>
          <div className="progress hero-card__progress" aria-hidden="true">
            <span style={{ width: `${completed ? 100 : progress}%` }} />
          </div>
        </div>

        <div className="hero-card__footer">
          <span className="hero-card__source">
            <SourceLogo sourceId={record.sourceId} className="hero-card__source-logo" />
            <span>{getSourceDisplayName(profile)}</span>
          </span>
          <button
            type="button"
            className="button button--dark hero-card__cta"
            onClick={(event) => { event.stopPropagation(); onContinue(); }}
          >
            <ContinueIcon size={17} />
            {t("home.continue")}
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
