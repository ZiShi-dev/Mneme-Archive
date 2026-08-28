import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  Clapperboard,
  Download,
  Gauge,
  Home,
  Minus,
  Plus,
  RefreshCw,
  Smartphone,
  Wifi,
} from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import {
  DATA_USAGE_PRESETS,
  buildDataUsageSummary,
  detectDataUsagePreset,
} from "../lib/settings/dataPresets";
import { DEFAULT_APP_SETTINGS, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../lib/settings/defaults";
import { getPreloadNetworkStatus, refreshNetworkStatus } from "../lib/platform/networkStatus";
import { useI18n } from "../i18n/I18nProvider";

const POLL_OPTIONS = [1, 2, 5, 10];
const BACKGROUND_INTERVAL_OPTIONS = [15, 30, 60];

function SheetSwitch({ enabled, onToggle, label }) {
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

export function DataUsageSettingsSheet({
  open,
  onClose,
  settings,
  onApplyPreset,
  onToggleWifiOnly,
  onTogglePreload,
  onSetPreloadPages,
  onToggleHomeAutoUpdates,
  onToggleVideoDataSaver,
  onToggleBackgroundSync,
  onSetPollMinutes,
  onSetBackgroundIntervalMinutes,
}) {
  const { t } = useI18n();
  const [networkStatus, setNetworkStatus] = useState(() => getPreloadNetworkStatus());

  useEffect(() => {
    if (!open) return undefined;

    const updateStatus = () => { void refreshNetworkStatus().then(setNetworkStatus); };
    updateStatus();

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const handleConnectionChange = () => updateStatus();
    connection?.addEventListener?.("change", handleConnectionChange);

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      connection?.removeEventListener?.("change", handleConnectionChange);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const wifiOnly = settings.wifi !== false;
  const preloadEnabled = settings.preload !== false;
  const homeAutoUpdates = settings.homeAutoUpdates !== false;
  const videoDataSaver = settings.videoDataSaver !== false;
  const backgroundEnabled = settings.backgroundSync !== false;
  const pollMinutes = settings.followPollMinutes || DEFAULT_APP_SETTINGS.followPollMinutes;
  const backgroundInterval = settings.backgroundIntervalMinutes || DEFAULT_APP_SETTINGS.backgroundIntervalMinutes;
  const activePreset = detectDataUsagePreset(settings);
  const preloadPages = Math.max(
    PRELOAD_PAGES_MIN,
    Math.min(PRELOAD_PAGES_MAX, Number(settings.preloadPages) || DEFAULT_APP_SETTINGS.preloadPages),
  );

  let networkStatusText = t("data.connected", { label: networkStatus.label });
  let networkStatusTone = "neutral";
  if (wifiOnly) {
    networkStatusTone = networkStatus.wifiLike ? "active" : "paused";
    networkStatusText += networkStatus.wifiLike
      ? ` — ${t("data.fullAllowed")}`
      : ` — ${t("data.heavyStopped")}`;
  }

  return (
    <SheetPortal>
    <div
      className="notify-sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="notify-sheet preload-sheet data-usage-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-usage-sheet-title"
      >
        <header>
          <div>
            <small>{t("data.network")}</small>
            <h2 id="data-usage-sheet-title">{t("data.usage")}</h2>
          </div>
          <SheetCloseButton onClick={onClose} />
        </header>

        <div className="notify-sheet__body preload-sheet__body data-usage-sheet__body">
          <section className="data-usage-sheet__presets" aria-label={t("data.ready")}>
            <p className="notify-sheet__label"><Gauge size={14} /> {t("data.fast")}</p>
            <div className="notify-sheet__chips" role="group" aria-label={t("data.files")}>
              {Object.values(DATA_USAGE_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={activePreset === preset.id ? "active" : ""}
                  aria-pressed={activePreset === preset.id}
                  onClick={() => onApplyPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
              {activePreset === "custom" && (
                <button type="button" className="active" aria-pressed="true">{t("data.custom")}</button>
              )}
            </div>
            <p className="preload-sheet__caption">
              {activePreset === "custom"
                ? t("data.customHint")
                : DATA_USAGE_PRESETS[activePreset]?.hint}
            </p>
          </section>

          <div className="preload-sheet__divider" aria-hidden="true" />

          <section className="preload-sheet__block" aria-label={t("data.limits")}>
            <div className="preload-sheet__wifi">
              <div className="preload-sheet__wifi-copy">
                <span className="preload-sheet__wifi-icon"><Wifi size={16} /></span>
                <div>
                  <strong>{t("data.wifiOnly")}</strong>
                  <small>{t("data.wifiHint")}</small>
                </div>
              </div>
              <SheetSwitch
                enabled={wifiOnly}
                label={wifiOnly ? t("data.disableWifi") : t("data.enableWifi")}
                onToggle={onToggleWifiOnly}
              />
            </div>
            <p className={`preload-sheet__status preload-sheet__status--${networkStatusTone}`}>
              {networkStatusText}
            </p>
          </section>

          <div className="preload-sheet__divider" aria-hidden="true" />

          <section className="preload-sheet__block" aria-label={t("data.preload")}>
            <div className="preload-sheet__toggle">
              <div className="preload-sheet__toggle-copy">
                <span className="preload-sheet__toggle-icon"><Download size={16} /></span>
                <div>
                  <strong>{t("data.preloadPages")}</strong>
                  <small>{t("data.preloadHint")}</small>
                </div>
              </div>
              <SheetSwitch
                enabled={preloadEnabled}
                label={preloadEnabled ? t("data.disablePreload") : t("data.enablePreload")}
                onToggle={onTogglePreload}
              />
            </div>

            {preloadEnabled && (
              <div className="preload-sheet__stepper" role="group" aria-label={t("data.pageCount")}>
                <button
                  type="button"
                  className="preload-sheet__stepper-btn"
                  aria-label={t("data.decreasePages")}
                  disabled={preloadPages <= PRELOAD_PAGES_MIN}
                  onClick={() => onSetPreloadPages(preloadPages - 1)}
                >
                  <Minus size={18} />
                </button>
                <div className="preload-sheet__stepper-value">
                  <input
                    type="number"
                    min={PRELOAD_PAGES_MIN}
                    max={PRELOAD_PAGES_MAX}
                    inputMode="numeric"
                    aria-label={t("data.pageCount")}
                    value={preloadPages}
                    onChange={(event) => onSetPreloadPages(event.target.value)}
                  />
                  <small>{t("data.page")}</small>
                </div>
                <button
                  type="button"
                  className="preload-sheet__stepper-btn"
                  aria-label={t("data.increasePages")}
                  disabled={preloadPages >= PRELOAD_PAGES_MAX}
                  onClick={() => onSetPreloadPages(preloadPages + 1)}
                >
                  <Plus size={18} />
                </button>
              </div>
            )}
          </section>

          <div className="preload-sheet__divider" aria-hidden="true" />

          <section className="preload-sheet__block" aria-label={t("data.home")}>
            <div className="preload-sheet__toggle">
              <div className="preload-sheet__toggle-copy">
                <span className="preload-sheet__toggle-icon"><Home size={16} /></span>
                <div>
                  <strong>{t("data.homeUpdates")}</strong>
                  <small>{t("data.homeUpdatesHint")}</small>
                </div>
              </div>
              <SheetSwitch
                enabled={homeAutoUpdates}
                label={homeAutoUpdates ? t("data.disableAuto") : t("data.enableAuto")}
                onToggle={onToggleHomeAutoUpdates}
              />
            </div>
          </section>

          <section className="preload-sheet__block" aria-label={t("data.video")}>
            <div className="preload-sheet__toggle">
              <div className="preload-sheet__toggle-copy">
                <span className="preload-sheet__toggle-icon"><Clapperboard size={16} /></span>
                <div>
                  <strong>{t("data.videoSaver")}</strong>
                  <small>{t("data.videoSaverHint")}</small>
                </div>
              </div>
              <SheetSwitch
                enabled={videoDataSaver}
                label={videoDataSaver ? t("data.disableVideoSaver") : t("data.enableVideoSaver")}
                onToggle={onToggleVideoDataSaver}
              />
            </div>
          </section>

          <div className="preload-sheet__divider" aria-hidden="true" />

          <section className="preload-sheet__block" aria-label={t("data.sync")}>
            <p className="notify-sheet__label"><RefreshCw size={14} /> {t("data.syncHint")}</p>
            <div className="notify-sheet__chips" role="group" aria-label={t("data.pollEvery")}>
              {POLL_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={pollMinutes === minutes ? "active" : ""}
                  aria-pressed={pollMinutes === minutes}
                  onClick={() => onSetPollMinutes(minutes)}
                >
                  {t("data.minutes", { minutes })}
                </button>
              ))}
            </div>

            <div className="preload-sheet__toggle data-usage-sheet__background">
              <div className="preload-sheet__toggle-copy">
                <span className="preload-sheet__toggle-icon"><Smartphone size={16} /></span>
                <div>
                  <strong>{t("data.background")}</strong>
                  <small>{t("data.androidOnly")}</small>
                </div>
              </div>
              <SheetSwitch
                enabled={backgroundEnabled}
                label={backgroundEnabled ? t("data.disableBackground") : t("data.enableBackground")}
                onToggle={onToggleBackgroundSync}
              />
            </div>

            {backgroundEnabled && (
              <>
                <p className="notify-sheet__label">{t("data.backgroundEvery")}</p>
                <div className="notify-sheet__chips" role="group" aria-label={t("data.backgroundEvery")}>
                  {BACKGROUND_INTERVAL_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      className={backgroundInterval === minutes ? "active" : ""}
                      aria-pressed={backgroundInterval === minutes}
                      onClick={() => onSetBackgroundIntervalMinutes(minutes)}
                    >
                      {t("data.minutes", { minutes })}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="preload-sheet__footer">
          <button type="button" className="notify-sheet__done preload-sheet__done" onClick={onClose}>
            {t("common.done")}
          </button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}

export function DataUsageSettingsEntry({ settings, onOpen }) {
  const { t } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Gauge size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("data.usage")}</strong>
        <small>{buildDataUsageSummary(settings)}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}
