import React from "react";
import { ChevronLeft, Lock } from "lucide-react";
import { getSourceProfile, getSourceDisplayName } from "../config/sources";
import { contentTypes } from "../features/sources/contentTypes";
import { RemoteCover, SourceLogo } from "../features/sources";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { formatFollowUpdateLine } from "../lib/updates/followMessaging";
import { formatChapterPublishedLabel } from "../lib/updates/homeLatestChapters";
import { useI18n } from "../i18n/I18nProvider";
import { isCatalogChapterBlocked } from "../lib/media/chapterLock";
import { UnlockCountdown } from "../components/media/UnlockCountdown";

export function HomeLatestChapterRow({ entry, onClick, onPrefetch, lazyCover = false }) {
  const { t } = useI18n();
  const chapter = entry.latestChapter;
  const timeLabel = formatChapterPublishedLabel(entry.publishedAt);
  const updateLine = formatFollowUpdateLine({
    mediaType: entry.mediaType,
    chapterNumber: chapter.number || chapter.name,
    chapterName: chapter.name,
  });
  const mediaLabel = contentTypes[entry.mediaType]?.singular || contentTypes.all.singular;
  const profile = getSourceProfile(entry.item.sourceId);
  const blocked = isCatalogChapterBlocked(entry.item?.sourceId, chapter);

  return (
    <button
      type="button"
      className={`home-latest-row${entry.isNew ? " home-latest-row--new" : ""}${blocked ? " home-latest-row--locked" : ""}`}
      onClick={onClick}
      onPointerDown={onPrefetch}
    >
      <span className="home-latest-row__cover">
        <RemoteCover
          src={entry.item.cover}
          title={entry.item.title}
          sourceId={entry.item.sourceId}
          novel={entry.mediaType === "novel"}
          video={isVideoMediaType(entry.mediaType)}
          lazy={lazyCover}
        />
        {entry.isNew && <span className="home-latest-row__badge">{t("common.new")}</span>}
      </span>

      <span className="home-latest-row__body">
        <span className="home-latest-row__meta">
          <SourceLogo sourceId={entry.item.sourceId} className="home-latest-row__source" />
          <small>{getSourceDisplayName(profile)}</small>
          <em>{mediaLabel}</em>
          {timeLabel && (
            <time dateTime={entry.publishedAt} className="home-latest-row__time">
              {timeLabel}
            </time>
          )}
        </span>
        <strong dir="auto">{entry.item.title}</strong>
        <span className="home-latest-row__chapter">
          {blocked ? <Lock size={12} aria-hidden="true" /> : null}
          {updateLine}
        </span>
        {blocked ? <UnlockCountdown unlockAt={chapter.unlockAt} className="unlock-countdown--compact" /> : null}
      </span>

      <ChevronLeft size={15} className="home-latest-row__chevron" aria-hidden="true" />
    </button>
  );
}
