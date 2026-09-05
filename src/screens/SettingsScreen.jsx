import React, { useEffect } from "react";
import { BellRing, ChevronLeft, Download, Globe2, History, Layers, SlidersHorizontal } from "lucide-react";
import { EnableSourcesSheet } from "../features/sources";
import { Header } from "../components/layout/Header";
import { useToast } from "../components/ui/ToastProvider";
import { usePersistedState } from "../hooks/usePersistedState";
import { useSettingsPanel } from "../hooks/useSettingsPanel";
import { useI18n } from "../i18n/I18nProvider";
import { DATA_USAGE_PRESETS } from "../lib/settings/dataPresets";
import { DEFAULT_APP_SETTINGS, PRELOAD_PAGES_MAX, PRELOAD_PAGES_MIN } from "../lib/settings/defaults";
import { normalizeSettings } from "../lib/settings/normalizeSettings";
import { setRuntimeSettings } from "../lib/settings/runtimeSettings";
import { DataUsageSettingsEntry, DataUsageSettingsSheet } from "./DataUsageSettingsPanel";
import { LanguageSettingsEntry, LanguageSettingsSheet } from "./LanguageSettingsPanel";
import { ThemeSettingsEntry, ThemeSettingsSheet } from "./ThemeSettingsPanel";
import { FontSettingsEntry, FontSettingsSheet } from "./FontSettingsPanel";
import { SourceUrlsSettingsEntry, SourceUrlsSettingsSheet } from "./SourceUrlsSettingsPanel";
import { FlareSolverrSettingsEntry, FlareSolverrSettingsSheet } from "./FlareSolverrSettingsPanel";
import { AppMark } from "../components/brand/AppMark";
import { AppBrandName } from "../components/brand/AppBrandName";
import { getSourceDisplayName } from "../config/sources";
import { getAppBrandText } from "../lib/brand/appBrand";
import { isChromebookApp } from "../config/appFlavor";
import {
  countSourceBaseUrlOverrides,
  getDefaultSourceBaseUrl,
  normalizeSourceBaseUrl,
} from "../lib/settings/sourceBaseUrls.js";

export function SettingsScreen({ navigate, appearance, typeface, onSetAppearance, onSetTypeface, sources, sourcePreferences, onToggleSite, onSetSitesEnabled }) {
  const { t } = useI18n();
  const brand = getAppBrandText(t);
  const { pushToast } = useToast();
  const [rawSettings, setRawSettings] = usePersistedState("mangashelf:settings", DEFAULT_APP_SETTINGS);
  const settings = normalizeSettings(rawSettings);
  const panels = useSettingsPanel();
  const activeSourceCount = sources.filter((entry) => entry.enabled !== false).length;
  const sourceUrlOverrideCount = countSourceBaseUrlOverrides(settings.sourceBaseUrls);

  useEffect(() => {
    setRuntimeSettings(settings);
  }, [settings]);

  const setSettings = (updater) => {
    setRawSettings((current) => normalizeSettings(typeof updater === "function" ? updater(normalizeSettings(current)) : updater));
  };

  const notifyUpdated = (message = t("settings.updated")) => {
    pushToast({ type: "success", message });
  };

  const setPreloadPages = (nextValue) => {
    const value = Math.max(PRELOAD_PAGES_MIN, Math.min(PRELOAD_PAGES_MAX, Number(nextValue) || PRELOAD_PAGES_MIN));
    setSettings((current) => {
      if (current.preloadPages === value) return current;
      return { ...current, preloadPages: value };
    });
  };

  const applyPreset = (presetId) => {
    const preset = DATA_USAGE_PRESETS[presetId];
    if (!preset) return;
    setSettings((current) => ({ ...current, ...preset.settings }));
    notifyUpdated(t("settings.presetApplied", { label: preset.label }));
  };

  return (
    <div className={`screen${isChromebookApp ? " screen--settings-desktop" : ""}`}>
      {isChromebookApp ? (
        <header className="settings-desktop-head">
          <span className="eyebrow">{isChromebookApp ? t("settings.eyebrowDesktop") : t("settings.eyebrow")}</span>
          <h1>{t("settings.title")}</h1>
        </header>
      ) : (
        <Header
          title={t("settings.title")}
          eyebrow={t("settings.eyebrow")}
          showBrand
          appearance={appearance}
          onSearch={() => navigate("search")}
          onReadingHistory={() => navigate("reading-history")}
          onDownloads={() => navigate("downloads")}
          onNotifications={() => navigate("updates")}
        />
      )}
      <main className="content settings-page">
        <section className="settings-profile">
          <span className="settings-profile__seal" aria-hidden="true">
            <AppMark size={42} appearance={appearance} decorative />
          </span>
          <div>
            <AppBrandName
              as="strong"
              variant="profile"
              lead={brand.nameLead}
              tail={brand.nameTail}
            >
              {brand.profileName}
            </AppBrandName>
            <small>{isChromebookApp ? t("settings.profileHintDesktop") : t("settings.profileHint")}</small>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-group-title">{t("settings.sources")}</h2>
          <div className="settings-group">
          <button type="button" className="setting-row" onClick={() => navigate("source-management")}>
            <span className="setting-row__icon"><Layers size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("settings.manageSources")}</strong>
              <small>{t("settings.connectedSources", { count: activeSourceCount })}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="setting-row" onClick={() => panels.open("enable-sources")}>
            <span className="setting-row__icon"><Globe2 size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("settings.enableSources")}</strong>
              <small>{t("settings.enableSourcesHint", { enabled: activeSourceCount, total: sources.length })}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          <SourceUrlsSettingsEntry
            overrideCount={sourceUrlOverrideCount}
            onOpen={() => panels.open("source-urls")}
          />
          {!isChromebookApp && (
            <FlareSolverrSettingsEntry
              baseUrl={settings.flareSolverrUrl}
              onOpen={() => panels.open("flare")}
            />
          )}
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-group-title">{t("settings.updates")}</h2>
          <div className="settings-group">
          <button type="button" className="setting-row" onClick={() => navigate("notification-center")}>
            <span className="setting-row__icon"><BellRing size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("settings.notificationCenter")}</strong>
              <small>{isChromebookApp ? t("settings.notificationCenterHintDesktop") : t("settings.notificationCenterHint")}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          <DataUsageSettingsEntry settings={settings} onOpen={() => panels.open("data-usage")} />
          <button type="button" className="setting-row" onClick={() => navigate("downloads")}>
            <span className="setting-row__icon"><Download size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("downloads.title")}</strong>
              <small>{isChromebookApp ? t("settings.downloadsHintDesktop") : t("settings.downloadsHint")}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-group-title">{t("settings.appearanceGroup")}</h2>
          <div className="settings-group">
          <ThemeSettingsEntry appearance={appearance} onOpen={() => panels.open("theme")} />
          <FontSettingsEntry typeface={typeface} onOpen={() => panels.open("font")} />
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-group-title">{isChromebookApp ? t("settings.displayDesktop") : t("settings.display")}</h2>
          <div className="settings-group">
          <button type="button" className="setting-row" onClick={() => navigate("reading-history")}>
            <span className="setting-row__icon"><History size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("common.readingHistory")}</strong>
              <small>{isChromebookApp ? t("settings.historyHintDesktop") : t("settings.historyHint")}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          <LanguageSettingsEntry onOpen={() => panels.open("language")} />
          {!isChromebookApp && (
          <button type="button" className="setting-row">
            <span className="setting-row__icon"><SlidersHorizontal size={19} /></span>
            <span className="setting-row__copy">
              <strong>{t("settings.readingMode")}</strong>
              <small>{t("settings.readingModeHint")}</small>
            </span>
            <ChevronLeft size={18} />
          </button>
          )}
          </div>
        </section>
        <p className="app-version">{t("app.version")}</p>
      </main>

      <ThemeSettingsSheet
        open={panels.isOpen("theme")}
        onClose={panels.close}
        appearance={appearance}
        onSetAppearance={onSetAppearance}
      />
      <FontSettingsSheet
        open={panels.isOpen("font")}
        onClose={panels.close}
        typeface={typeface}
        onSetTypeface={onSetTypeface}
      />
      <LanguageSettingsSheet open={panels.isOpen("language")} onClose={panels.close} />
      <SourceUrlsSettingsSheet
        open={panels.isOpen("source-urls")}
        onClose={panels.close}
        sourceBaseUrls={settings.sourceBaseUrls}
        onSaveOverride={(sourceId, nextUrl) => {
          setSettings((current) => {
            const defaultUrl = getDefaultSourceBaseUrl(sourceId);
            const normalized = normalizeSourceBaseUrl(sourceId, nextUrl);
            const nextOverrides = { ...(current.sourceBaseUrls || {}) };
            if (!defaultUrl || normalized === defaultUrl) delete nextOverrides[sourceId];
            else nextOverrides[sourceId] = normalized;
            const next = { ...current, sourceBaseUrls: nextOverrides };
            return next;
          });
          notifyUpdated(t("settings.sourceUrlUpdated", { name: getSourceDisplayName(sourceId) }));
        }}
      />
      <FlareSolverrSettingsSheet
        open={panels.isOpen("flare")}
        onClose={panels.close}
        baseUrl={settings.flareSolverrUrl}
        onSave={(nextUrl) => {
          setSettings((current) => ({ ...current, flareSolverrUrl: nextUrl }));
          notifyUpdated(t("settings.flareSolverrUrlUpdated"));
        }}
      />
      <EnableSourcesSheet
        open={panels.isOpen("enable-sources")}
        sources={sources}
        sourcePreferences={sourcePreferences}
        onClose={panels.close}
        onToggleSite={onToggleSite}
        onSetSitesEnabled={onSetSitesEnabled}
      />
      <DataUsageSettingsSheet
        open={panels.isOpen("data-usage")}
        onClose={panels.close}
        settings={settings}
        onApplyPreset={applyPreset}
        onToggleWifiOnly={() => {
          setSettings((current) => ({ ...current, wifi: current.wifi === false }));
          notifyUpdated();
        }}
        onTogglePreload={() => {
          setSettings((current) => ({ ...current, preload: current.preload === false }));
          notifyUpdated();
        }}
        onSetPreloadPages={setPreloadPages}
        onToggleHomeAutoUpdates={() => {
          setSettings((current) => ({ ...current, homeAutoUpdates: current.homeAutoUpdates === false }));
          notifyUpdated();
        }}
        onToggleVideoDataSaver={() => {
          setSettings((current) => ({ ...current, videoDataSaver: current.videoDataSaver === false }));
          notifyUpdated();
        }}
        onToggleBackgroundSync={() => {
          setSettings((current) => ({ ...current, backgroundSync: current.backgroundSync === false }));
          notifyUpdated();
        }}
        onSetPollMinutes={(minutes) => {
          setSettings((current) => ({ ...current, followPollMinutes: minutes }));
          notifyUpdated(t("settings.pollUpdated", { minutes }));
        }}
        onSetBackgroundIntervalMinutes={(minutes) => {
          setSettings((current) => ({ ...current, backgroundIntervalMinutes: minutes }));
          notifyUpdated(t("settings.backgroundPollUpdated", { minutes }));
        }}
      />
    </div>
  );
}
