import React, { useState } from "react";
import { Bell, BellRing, ChevronLeft } from "lucide-react";
import { describeFollowInterval, resolveFollowMediaType } from "../../lib/updates/followMessaging";
import { useI18n } from "../../i18n/I18nProvider";
import { FollowAlertSheet } from "./FollowAlertSheet";

export function FollowAlertCard({
  item,
  preference,
  latestChapter,
  onSavePreference,
  onRemovePreference,
}) {
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isFollowing = Boolean(preference?.enabled);
  const mediaType = resolveFollowMediaType({ ...item, ...preference });
  const followHint = mediaType === "movie"
    ? t("follow.pickWhen")
    : mediaType === "anime" || mediaType === "series"
      ? t("follow.pickEpisodes")
      : t("follow.pickChapters");

  return (
    <>
      <section className="follow-alert-card" aria-label={t("follow.title")}>
        <div className="follow-alert-card__copy">
          <span className="follow-alert-card__icon">
            {isFollowing ? <BellRing size={18} /> : <Bell size={18} />}
          </span>
          <div>
            <strong>{isFollowing ? t("follow.following") : t("follow.followCta")}</strong>
            <small>
              {isFollowing
                ? describeFollowInterval(preference.interval, mediaType)
                : followHint}
            </small>
          </div>
        </div>

        <div className="follow-alert-card__actions">
          <button
            type="button"
            className={`follow-alert-card__configure ${isFollowing ? "active" : ""}`}
            onClick={() => setSheetOpen(true)}
          >
            <span>{isFollowing ? t("follow.edit") : t("follow.enable")}</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      </section>

      {sheetOpen && (
        <FollowAlertSheet
          item={item}
          preference={preference}
          onSave={(partial) => onSavePreference(item, partial, latestChapter)}
          onDisable={() => onRemovePreference(item)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
