import React from "react";
import {
  Bell,
  BellRing,
  ChevronLeft,
  Clock3,
  Smartphone,
  Zap,
} from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { useI18n } from "../i18n/I18nProvider";

const POLL_HINT_KEYS = {
  1: "data.fast",
  2: "data.balanced",
  5: "data.saver",
};

function NotifySwitch({ enabled, onToggle, label }) {
  return (
    <button
      type="button"
      className={`notify-sheet__switch${enabled ? " notify-sheet__switch--on" : ""}`}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
    >
      <i />
    </button>
  );
}

export function NotificationSettingsSheet({
  open,
  onClose,
  settings,
  permission,
  backgroundStatus,
  isNative,
  onToggleNotifications,
  onToggleBackgroundSync,
  onSetPollMinutes,
  onRequestPermission,
  onTestNotification,
  onTestBackgroundSync,
}) {
  const { t } = useI18n();

  if (!open) return null;

  const enabled = settings.notifications;
  const pollMinutes = settings.followPollMinutes || 2;
  const backgroundEnabled = settings.backgroundSync !== false;
  const pollOptions = [1, 2, 5];

  return (
    <SheetPortal>
    <div
      className="notify-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="notify-sheet" role="dialog" aria-modal="true" aria-labelledby="notify-sheet-title">
        <header>
          <div>
            <small>{t("notify.eyebrow")}</small>
            <h2 id="notify-sheet-title">{t("notify.title")}</h2>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <div className="notify-sheet__body">
          <div className="notify-sheet__row">
            <span><BellRing size={15} /> {t("notify.enable")}</span>
            <NotifySwitch
              enabled={enabled}
              label={enabled ? t("notify.disable") : t("notify.enable")}
              onToggle={onToggleNotifications}
            />
          </div>

          {enabled && (
            <>
              <div className="notify-sheet__group">
                <p className="notify-sheet__label"><Zap size={14} /> {t("notify.checkOnOpen")}</p>
                <div className="notify-sheet__chips" role="group" aria-label={t("notify.pollGroup")}>
                  {pollOptions.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={pollMinutes === minutes ? "active" : ""}
                      aria-pressed={pollMinutes === minutes}
                      title={t(POLL_HINT_KEYS[minutes])}
                      onClick={() => onSetPollMinutes(minutes)}
                    >
                      {t("data.minutes", { minutes })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="notify-sheet__row">
                <span>
                  <Clock3 size={15} /> {t("notify.background")}{" "}
                  <small>{t("notify.everyN", { n: settings.backgroundIntervalMinutes || 30 })}</small>
                </span>
                <NotifySwitch
                  enabled={backgroundEnabled}
                  label={backgroundEnabled ? t("data.disableBackground") : t("data.enableBackground")}
                  onToggle={onToggleBackgroundSync}
                />
              </div>

              {isNative && (
                <div className="notify-sheet__tools">
                  {!permission.granted && (
                    <button type="button" className="notify-sheet__tools-primary" onClick={onRequestPermission}>
                      {t("notify.phonePermission")}
                    </button>
                  )}
                  <button type="button" onClick={onTestNotification}>{t("notify.test")}</button>
                  {backgroundEnabled && (
                    <button type="button" onClick={onTestBackgroundSync}>{t("notify.testBackground")}</button>
                  )}
                </div>
              )}

              <p className="notify-sheet__hint">
                {t("notify.intervalHint")}
                {!isNative && ` ${t("notify.browserOnly")}`}
                {isNative && backgroundStatus.registered && ` · ${t("notify.backgroundOn")}`}
              </p>
            </>
          )}
        </div>

        <footer>
          <button type="button" className="notify-sheet__done" onClick={onClose}>{t("common.done")}</button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}

export function NotificationSettingsEntry({ settings, isNative, permission, onOpen }) {
  const { t } = useI18n();
  const enabled = settings.notifications;
  const pollMinutes = settings.followPollMinutes || 2;

  let summary = t("notify.off");
  if (enabled) {
    summary = t("data.minutes", { minutes: pollMinutes });
    if (isNative && !permission.granted) summary += ` · ${t("notify.permissionNeeded")}`;
    else if (enabled) summary += ` · ${t("notify.phonePlus")}`;
  }

  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon">
        {enabled ? <BellRing size={19} /> : <Bell size={19} />}
      </span>
      <span className="setting-row__copy">
        <strong>{t("notify.chapters")}</strong>
        <small>{summary}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}
