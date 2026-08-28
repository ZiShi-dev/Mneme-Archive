import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  ChevronLeft,
  Clock3,
  Settings2,
  Smartphone,
  Zap,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { EmptyState } from "../components/ui/EmptyState";
import { AccessibleSearchField } from "../components/ui/AccessibleSearchField";
import { useToast } from "../components/ui/ToastProvider";
import { useNotificationSettings } from "../hooks/useNotificationSettings";
import { getSourceProfile } from "../config/sources";
import { RemoteCover, SourceLogo } from "../features/sources";
import { contentTypes } from "../features/sources/contentTypes";
import { FollowAlertSheet } from "../features/updates/FollowAlertSheet";
import { describeFollowInterval } from "../lib/updates/followKeys";
import { resolveFollowMediaType } from "../lib/updates/followMessaging";
import { isVideoMediaType } from "../features/sources/mediaPresentation";
import { useI18n } from "../i18n/I18nProvider";
import {
  NotificationSettingsEntry,
  NotificationSettingsSheet,
} from "./NotificationSettingsPanel";

function FollowPreferenceRow({ preference, onEdit, onOpen, t }) {
  const profile = getSourceProfile(preference.sourceId);
  const mediaType = resolveFollowMediaType(preference);
  const mediaLabel = contentTypes[mediaType]?.singular || t("content.mangaSingular");

  return (
    <div className="notify-center-row">
      <button type="button" className="notify-center-row__main" onClick={onOpen}>
        <RemoteCover
          src={preference.cover}
          title={preference.title}
          sourceId={preference.sourceId}
          className="notify-center-row__cover"
          video={isVideoMediaType(mediaType)}
          novel={mediaType === "novel"}
        />
        <span className="notify-center-row__copy">
          <span className="notify-center-row__meta">
            <SourceLogo sourceId={preference.sourceId} className="notify-center-row__source" />
            <small>{profile.name}</small>
            <em>{mediaLabel}</em>
          </span>
          <strong dir="auto">{preference.title}</strong>
          <span>{describeFollowInterval(preference.interval, mediaType)}</span>
        </span>
        <ChevronLeft size={15} aria-hidden="true" />
      </button>
      <button type="button" className="notify-center-row__edit" onClick={onEdit} aria-label={t("notify.edit", { title: preference.title })}>
        <Settings2 size={15} />
      </button>
    </div>
  );
}

export function NotificationCenterScreen({
  chapterFollow,
  navigate,
  onBack,
  openLiveManga,
}) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const notificationSettings = useNotificationSettings(pushToast);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);

  const followedItems = useMemo(
    () => Object.values(chapterFollow.preferences || {})
      .filter((entry) => entry?.enabled !== false && entry?.url)
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ar")),
    [chapterFollow.preferences],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) return followedItems;
    return followedItems.filter((entry) => {
      const profile = getSourceProfile(entry.sourceId);
      return `${entry.title} ${entry.altTitle || ""} ${profile.name}`.toLowerCase().includes(normalizedQuery);
    });
  }, [followedItems, normalizedQuery]);

  const editingPreference = editingItem
    ? chapterFollow.getPreference(editingItem)
    : null;

  const globalEnabled = notificationSettings.settings.notifications;
  const pollMinutes = notificationSettings.settings.followPollMinutes || 2;
  const backgroundEnabled = notificationSettings.settings.backgroundSync !== false;

  return (
    <div className="screen">
      <Header
        title={t("notify.centerTitle")}
        eyebrow={t("notify.centerEyebrow")}
        onBack={onBack}
        onSearch={() => navigate("search")}
        onReadingHistory={() => navigate("reading-history")}
        onNotifications={() => navigate("updates")}
      />

      <main className="content notify-center-page">
        <section className="notify-center-hero">
          <span className="notify-center-hero__icon" aria-hidden="true">
            {globalEnabled ? <BellRing size={16} /> : <Bell size={16} />}
          </span>
          <div>
            <strong>{globalEnabled ? t("notify.on") : t("notify.offStatus")}</strong>
            <span>
              {t("notify.nFollowed", { count: followedItems.length })}
              {globalEnabled ? ` · ${t("notify.checkEvery", { n: pollMinutes })}` : ""}
              {globalEnabled && backgroundEnabled ? ` · ${t("notify.background15")}` : ""}
            </span>
          </div>
          <button type="button" className="notify-center-hero__feed" onClick={() => navigate("updates")}>
            {t("updates.title")}
            <ArrowRight size={14} />
          </button>
        </section>

        <h2 className="settings-group-title">{t("notify.general")}</h2>
        <div className="settings-group notify-center-global">
          <NotificationSettingsEntry
            settings={notificationSettings.settings}
            isNative={notificationSettings.isNative}
            permission={notificationSettings.permission}
            onOpen={() => setSheetOpen(true)}
          />
          <div className="notify-center-global__chips" aria-label={t("notify.summary")}>
            <span><Zap size={12} />{t("notify.openCheck", { n: pollMinutes })}</span>
            <span><Clock3 size={12} />{backgroundEnabled ? t("notify.backgroundOnShort") : t("notify.backgroundOffShort")}</span>
            {notificationSettings.isNative && (
              <span><Smartphone size={12} />{notificationSettings.permission.granted ? t("notify.granted") : t("notify.needed")}</span>
            )}
          </div>
        </div>

        <div className="notify-center-section-head">
          <h2 className="settings-group-title">{t("notify.followed")}</h2>
          <small>{followedItems.length}</small>
        </div>

        {followedItems.length > 3 && (
          <AccessibleSearchField
            className="notify-center-search"
            value={query}
            onChange={setQuery}
            placeholder={t("notify.searchPlaceholder")}
            ariaLabel={t("notify.searchAria")}
          />
        )}

        {visibleItems.length > 0 ? (
          <div className="notify-center-list">
            {visibleItems.map((preference) => (
              <FollowPreferenceRow
                key={`${preference.sourceId}:${preference.url}`}
                preference={preference}
                t={t}
                onEdit={() => setEditingItem(preference)}
                onOpen={() => openLiveManga(preference)}
              />
            ))}
          </div>
        ) : followedItems.length > 0 ? (
          <EmptyState
            className="notify-center-empty"
            icon={Bell}
            title={t("notify.noResults")}
            description={t("notify.tryOther")}
            actionLabel={t("common.clearSearch")}
            onAction={() => setQuery("")}
          />
        ) : (
          <EmptyState
            className="notify-center-empty"
            icon={BellRing}
            title={t("notify.noFollows")}
            description={t("notify.noFollowsHint")}
            actionLabel={t("history.discover")}
            onAction={() => navigate("sources")}
          />
        )}
      </main>

      <NotificationSettingsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        settings={notificationSettings.settings}
        permission={notificationSettings.permission}
        backgroundStatus={notificationSettings.backgroundStatus}
        isNative={notificationSettings.isNative}
        onToggleNotifications={notificationSettings.toggleNotifications}
        onToggleBackgroundSync={notificationSettings.toggleBackgroundSync}
        onSetPollMinutes={notificationSettings.setPollMinutes}
        onRequestPermission={notificationSettings.handleRequestPermission}
        onTestNotification={notificationSettings.handleTestNotification}
        onTestBackgroundSync={notificationSettings.handleTestBackgroundSync}
      />

      {editingItem && (
        <FollowAlertSheet
          item={editingItem}
          preference={editingPreference}
          onSave={(partial) => {
            chapterFollow.savePreference(editingItem, partial);
            pushToast({ type: "success", message: t("notify.followUpdated") });
          }}
          onDisable={() => {
            chapterFollow.removePreference(editingItem);
            pushToast({ type: "info", message: t("notify.followStopped") });
          }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
