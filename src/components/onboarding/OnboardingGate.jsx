import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { Check, Bell, Languages } from "lucide-react";
import { isChromebookApp } from "../../config/appFlavor";
import { AppMark } from "../brand/AppMark";
import { useStorage } from "../storage/StorageProvider";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useI18n } from "../../i18n/I18nProvider";
import { applyDocumentLocale } from "../../i18n/locales";
import { resolveMnemeMarkPalette } from "../../lib/brand/mnemeMarkPalettes.js";
import { t as runtimeT } from "../../i18n/runtime";
import { getAppBrandText } from "../../lib/brand/appBrand";
import {
  isExistingAppUser,
  ONBOARDING_COMPLETE_KEY,
  peekOnboardingComplete,
  shouldSkipOnboarding,
} from "../../lib/onboarding/constants";
import { requestNotificationPermission, getNotificationPermissionStatus } from "../../lib/notifications/pushNotifications";
import { persistStorageString } from "../../lib/storage/kvStore";
import { DEFAULT_APP_SETTINGS } from "../../lib/settings/defaults";
import { IMAGE_CACHE_DIR } from "../../lib/storage/constants";
import {
  THEME_INK,
  applyAppearance,
  isDarkTheme,
  normalizeThemeId,
  readBootAppearance,
  themeDefaultTypeface,
} from "../../lib/theme/appearance";
import { applyTypeface, FONT_SANS, normalizeTypefaceId, typefaceNameKey } from "../../lib/theme/typeface";
import { OnboardingThemePicker } from "./OnboardingThemePicker";
import { FontSelector } from "../../screens/FontSettingsPanel";
import { TYPEFACES } from "../../lib/theme/typeface";
import { ThemedBootScreen } from "../boot/ThemedBootScreen";
import { syncNativeChrome } from "../../lib/theme/nativeChrome";

const SPLASH_MS = 2400;

function buildOnboardingTheme(appearance) {
  const palette = resolveMnemeMarkPalette("auto", appearance);
  const dark = isDarkTheme(appearance);
  return {
    appearance,
    palette,
    className: dark ? "onboarding" : "onboarding onboarding--light",
    style: {
      "--onboarding-bg": palette.canvas,
      "--onboarding-star": palette.starGlow,
      "--onboarding-fg": dark ? "#F6F7F8" : "#171218",
    },
  };
}

async function hideNativeSplash() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // Plugin optionnel.
  }
}

async function prepareLocalStorage() {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const { Directory, Filesystem } = await import("@capacitor/filesystem");
    await Filesystem.mkdir({
      path: IMAGE_CACHE_DIR,
      directory: Directory.Data,
      recursive: true,
    });
    return true;
  } catch {
    return false;
  }
}

function OnboardingBackdrop({ children, theme }) {
  return (
    <div className={theme.className} style={theme.style} dir="auto">
      <div className="onboarding__glow" aria-hidden="true" />
      <div className="onboarding__stars" aria-hidden="true" />
      {children}
    </div>
  );
}

function OnboardingSplash({ theme, onDone }) {
  const brand = getAppBrandText(runtimeT);

  useEffect(() => {
    void hideNativeSplash();
    void syncNativeChrome(theme.appearance, theme.palette.canvas);
    const timer = window.setTimeout(onDone, SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [onDone, theme.appearance, theme.palette.canvas]);

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel onboarding__splash" role="status" aria-live="polite">
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <div className="onboarding__mark-ring" aria-hidden="true" />
          <AppMark
            size={96}
            variant="auto"
            appearance={theme.appearance}
            className="onboarding__mark"
            decorative
          />
        </div>
        <p className="onboarding__kicker">{brand.kicker}</p>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingLanguage({ theme, onContinue }) {
  const { locales, setLocale } = useI18n();
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    setLocale(selected);
    applyDocumentLocale(selected);
    onContinue();
  };

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel">
        <header className="onboarding__header">
          <div className="onboarding__bilingual">
            <h1>Choisissez votre langue</h1>
            <small>اختر لغتك</small>
          </div>
          <p>Français · العربية</p>
        </header>

        <div className="onboarding__language-grid" role="group" aria-label="Language">
          {Object.values(locales).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selected === entry.id ? "active" : ""}
              aria-pressed={selected === entry.id}
              onClick={() => setSelected(entry.id)}
            >
              <Languages size={20} />
              <span>
                <strong>{entry.nativeName}</strong>
                <small>{entry.id === "ar" ? "من اليمين إلى اليسار" : "De gauche à droite"}</small>
              </span>
              {selected === entry.id ? <Check size={16} /> : <span aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="onboarding__actions">
          <button
            type="button"
            className="onboarding__primary"
            disabled={!selected}
            onClick={handleContinue}
          >
            {selected === "fr" ? "Continuer" : selected === "ar" ? "متابعة" : "Continuer / متابعة"}
          </button>
        </div>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingPermissions({ theme, onContinue, onResolveNotifications }) {
  const { t, dir } = useI18n();
  const [notificationsDone, setNotificationsDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const finishStep = async () => {
    if (notificationsDone) {
      onContinue();
      return;
    }
    setBusy(true);
    try {
      const status = await getNotificationPermissionStatus();
      await onResolveNotifications?.(status.granted);
      onContinue();
    } finally {
      setBusy(false);
    }
  };

  const requestNotifications = async () => {
    setBusy(true);
    try {
      const result = await requestNotificationPermission();
      const granted = Boolean(result.granted);
      setNotificationsDone(granted);
      if (granted) {
        await onResolveNotifications?.(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel" dir={dir}>
        <header className="onboarding__header">
          <h1>{t("onboarding.permissionsTitle")}</h1>
          <p>{t("onboarding.permissionsSubtitle")}</p>
        </header>

        <div className="onboarding__permissions">
          <article className={`onboarding__permission-card${notificationsDone ? " is-done" : ""}`}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
              <Bell size={20} />
              <div>
                <strong>{t("onboarding.notificationsTitle")}</strong>
                <p>{t("onboarding.notificationsHint")}</p>
              </div>
            </div>
            <button
              type="button"
              className="onboarding__secondary"
              disabled={busy || notificationsDone}
              onClick={() => void requestNotifications()}
            >
              {notificationsDone ? t("onboarding.notificationsGranted") : t("onboarding.notificationsAction")}
            </button>
          </article>
        </div>

        <div className="onboarding__actions">
          <button type="button" className="onboarding__primary" disabled={busy} onClick={() => void finishStep()}>
            {t("onboarding.continue")}
          </button>
          <button type="button" className="onboarding__ghost" disabled={busy} onClick={() => void finishStep()}>
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingTheme({ theme, appearance, onSetAppearance, onContinue }) {
  const { t, dir } = useI18n();

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel onboarding__panel--theme" dir={dir}>
        <header className="onboarding__header">
          <h1>{t("onboarding.themeTitle")}</h1>
          <p>{t("onboarding.themeSubtitle")}</p>
        </header>

        <OnboardingThemePicker appearance={appearance} onSetAppearance={onSetAppearance} />

        <div className="onboarding__actions">
          <button type="button" className="onboarding__primary" onClick={onContinue}>
            {t("onboarding.continue")}
          </button>
        </div>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingFont({ theme, typeface, onSetTypeface, onDone }) {
  const { t, dir } = useI18n();
  const preview = TYPEFACES[typeface] || TYPEFACES.sans;

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel onboarding__panel--font" dir={dir}>
        <header className="onboarding__header">
          <h1>{t("onboarding.fontTitle")}</h1>
          <p>{t("onboarding.fontSubtitle")}</p>
        </header>

        <div
          className="onboarding__font-preview"
          aria-live="polite"
          aria-atomic="true"
        >
          <small>{t("onboarding.fontSampleLabel")}</small>
          <p
            className="onboarding__font-sample-ar"
            dir="rtl"
            style={{ fontFamily: preview.arabic }}
          >
            {t("onboarding.fontSampleAr")}
          </p>
          <p
            className="onboarding__font-sample-fr"
            style={{ fontFamily: preview.sans }}
          >
            {t("onboarding.fontSampleFr")}
          </p>
          <p
            className="onboarding__font-sample-title"
            style={{ fontFamily: preview.display }}
          >
            {t(typefaceNameKey(typeface))}
          </p>
        </div>

        <div className="onboarding__font-grid">
          <FontSelector typeface={typeface} onSetTypeface={onSetTypeface} />
        </div>

        <div className="onboarding__actions">
          <button type="button" className="onboarding__primary" onClick={onDone}>
            {t("onboarding.finish")}
          </button>
        </div>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingFlow({ onComplete }) {
  const isNative = Capacitor.isNativePlatform();
  const [step, setStep] = useState("splash");
  const [appearance, setAppearanceRaw] = usePersistedState("living-archive:appearance", readBootAppearance());
  const [typeface, setTypefaceRaw] = usePersistedState("living-archive:typeface", FONT_SANS);
  const [, setSettings] = usePersistedState("mangashelf:settings", DEFAULT_APP_SETTINGS);
  const appearanceId = normalizeThemeId(appearance ?? THEME_INK);
  const typefaceId = normalizeTypefaceId(typeface ?? FONT_SANS);
  const theme = useMemo(() => buildOnboardingTheme(appearanceId), [appearanceId]);

  const setAppearance = useCallback((next) => {
    const normalized = normalizeThemeId(next);
    setAppearanceRaw(normalized);
    setTypefaceRaw(themeDefaultTypeface(normalized));
  }, [setAppearanceRaw, setTypefaceRaw]);

  const setTypeface = useCallback((next) => {
    setTypefaceRaw(normalizeTypefaceId(next));
  }, [setTypefaceRaw]);

  const goToFont = useCallback(() => setStep("font"), []);

  useEffect(() => {
    applyAppearance(appearanceId);
    applyTypeface(typefaceId);
    void syncNativeChrome(appearanceId, theme.palette.canvas);
  }, [appearanceId, typefaceId, theme.palette.canvas]);

  useEffect(() => {
    if (!isNative) return;
    void prepareLocalStorage();
  }, [isNative]);

  const finish = useCallback(() => {
    persistStorageString("living-archive:appearance", appearanceId);
    persistStorageString("living-archive:typeface", typefaceId);
    applyAppearance(appearanceId);
    applyTypeface(typefaceId);
    void hideNativeSplash();
    onComplete();
  }, [appearanceId, onComplete, typefaceId]);

  const goToTheme = useCallback(() => setStep("theme"), []);

  const resolveOnboardingNotifications = useCallback((granted) => {
    setSettings((current) => ({
      ...current,
      notifications: granted,
      backgroundSync: granted,
    }));
  }, [setSettings]);

  if (step === "splash") {
    return <OnboardingSplash theme={theme} onDone={() => setStep("language")} />;
  }

  if (step === "language") {
    return (
      <OnboardingLanguage
        theme={theme}
        onContinue={() => {
          if (isNative) setStep("permissions");
          else goToTheme();
        }}
      />
    );
  }

  if (step === "permissions") {
    return (
      <OnboardingPermissions
        theme={theme}
        onContinue={goToTheme}
        onResolveNotifications={resolveOnboardingNotifications}
      />
    );
  }

  if (step === "theme") {
    return (
      <OnboardingTheme
        theme={theme}
        appearance={appearanceId}
        onSetAppearance={setAppearance}
        onContinue={goToFont}
      />
    );
  }

  if (step === "font") {
    return (
      <OnboardingFont
        theme={theme}
        typeface={typefaceId}
        onSetTypeface={setTypeface}
        onDone={finish}
      />
    );
  }

  return null;
}

export function OnboardingGate({ children }) {
  const { ready } = useStorage();
  const [completePersisted, setCompletePersisted] = usePersistedState(ONBOARDING_COMPLETE_KEY, false);
  const [completeNow, setCompleteNow] = useState(() => peekOnboardingComplete());
  const complete = completeNow || completePersisted;

  const markComplete = useCallback(() => {
    persistStorageString(ONBOARDING_COMPLETE_KEY, "true");
    setCompleteNow(true);
    setCompletePersisted(true);
  }, [setCompletePersisted]);

  useEffect(() => {
    if (!ready || complete || isChromebookApp) return;
    if (isExistingAppUser()) {
      markComplete();
    }
  }, [ready, complete, markComplete]);

  if (isChromebookApp || shouldSkipOnboarding() || complete) {
    return children;
  }

  if (!ready) {
    return (
      <ThemedBootScreen
        appearance={readBootAppearance()}
        message={getAppBrandText(runtimeT).loading}
      />
    );
  }

  return <OnboardingFlow onComplete={markComplete} />;
}
