import React from "react";
import { ChevronLeft } from "lucide-react";
import { getSourceProfile } from "../../config/sources";
import { RemoteCover, SourceLogo } from "../sources";
import { contentTypes } from "../sources/contentTypes";
import { isVideoMediaType } from "../sources/mediaPresentation";
import { describeFollowInterval } from "../../lib/updates/followKeys";
import { resolveFollowMediaType } from "../../lib/updates/followMessaging";
import { useI18n } from "../../i18n/I18nProvider";

export function UpdatesFollowedPreview({ items = [], onOpen, onManage }) {
  const { t } = useI18n();

  if (!items.length) return null;

  return (
    <section className="updates-watching" aria-label={t("updates.followed")}>
      <div className="updates-watching__head">
        <h3>{t("updates.followed")}</h3>
        <button type="button" onClick={onManage}>{t("common.manage")}</button>
      </div>
      <div className="updates-watching__track">
        {items.map((item) => {
          const mediaType = resolveFollowMediaType(item);
          const mediaLabel = contentTypes[mediaType]?.singular || t("content.mangaSingular");
          const profile = getSourceProfile(item.sourceId);
          return (
            <button
              key={`${item.sourceId}:${item.url}`}
              type="button"
              className="updates-watching__card"
              onClick={() => onOpen?.(item)}
            >
              <RemoteCover
                src={item.cover}
                title={item.title}
                sourceId={item.sourceId}
                className="updates-watching__cover"
                video={isVideoMediaType(mediaType)}
                novel={mediaType === "novel"}
              />
              <span className="updates-watching__body">
                <span className="updates-watching__meta">
                  <SourceLogo sourceId={item.sourceId} className="updates-watching__source" />
                  <small>{profile.name}</small>
                  <em>{mediaLabel}</em>
                </span>
                <strong dir="auto">{item.title}</strong>
                <span>{describeFollowInterval(item.interval, mediaType)}</span>
              </span>
              <ChevronLeft size={14} className="updates-watching__chevron" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
