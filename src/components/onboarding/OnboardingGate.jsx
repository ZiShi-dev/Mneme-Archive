import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
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
  shouldSkipOnboarding,
} from "../../lib/onboarding/constants";
import { requestNotificationPermission } from "../../lib/notifications/pushNotifications";
import { peekStorageString } from "../../lib/storage/peek";
import { IMAGE_CACHE_DIR } from "../../lib/storage/constants";
import {
  THEME_INK,
  applyAppearance,
  isDarkTheme,
  normalizeThemeId,
} from "../../lib/theme/appearance";
import { ThemeSelector } from "../../screens/ThemeSettingsPanel";

const SPLASH_MS = 2400;

function readBootAppearance() {
  const appearanceRaw = peekStorageString("living-archive:appearance", "");
  if (appearanceRaw) return normalizeThemeId(appearanceRaw);

  try {
    const inkMode = JSON.parse(peekStorageString("living-archive:ink-mode", "true"));
    return normalizeThemeId(inkMode);
  } catch {
    return normalizeThemeId(true);
  }
}

function buildOnboardingTheme(appearance) {
  const palette = resolveMnemeMarkPalette("dark", appearance);
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

async function syncNativeChrome(backgroundColor, dark) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setBackgroundColor({ color: backgroundColor });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
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
    void syncNativeChrome(theme.palette.canvas, isDarkTheme(theme.appearance));
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
            variant="dark"
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

function OnboardingPermissions({ theme, onContinue }) {
  const { t, dir } = useI18n();
  const [notificationsDone, setNotificationsDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestNotifications = async () => {
    setBusy(true);
    try {
      const result = await requestNotificationPermission();
      setNotificationsDone(Boolean(result.granted));
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
          <button type="button" className="onboarding__primary" onClick={onContinue}>
            {t("onboarding.continue")}
          </button>
          <button type="button" className="onboarding__ghost" onClick={onContinue}>
            {t("onboarding.skip")}
          </button>
        </div>
      </div>
    </OnboardingBackdrop>
  );
}

function OnboardingTheme({ theme, appearance, onSetAppearance, onDone }) {
  const { t, dir } = useI18n();

  return (
    <OnboardingBackdrop theme={theme}>
      <div className="onboarding__panel onboarding__panel--theme" dir={dir}>
        <header className="onboarding__header">
          <h1>{t("onboarding.themeTitle")}</h1>
          <p>{t("onboarding.themeSubtitle")}</p>
        </header>

        <div className="onboarding__theme-grid">
          <ThemeSelector appearance={appearance} onSetAppearance={onSetAppearance} />
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
  const appearanceId = normalizeThemeId(appearance ?? THEME_INK);
  const theme = useMemo(() => buildOnboardingTheme(appearanceId), [appearanceId]);

  const setAppearance = useCallback((next) => {
    setAppearanceRaw(normalizeThemeId(next));
  }, [setAppearanceRaw]);

  useEffect(() => {
    applyAppearance(appearanceId);
    void syncNativeChrome(theme.palette.canvas, isDarkTheme(appearanceId));
  }, [appearanceId, theme.palette.canvas]);

  useEffect(() => {
    if (!isNative) return;
    void prepareLocalStorage();
  }, [isNative]);

  const finish = useCallback(() => {
    void hideNativeSplash();
    onComplete();
  }, [onComplete]);

  const goToTheme = useCallback(() => setStep("theme"), []);

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
    return <OnboardingPermissions theme={theme} onContinue={goToTheme} />;
  }

  if (step === "theme") {
    return (
      <OnboardingTheme
        theme={theme}
        appearance={appearanceId}
        onSetAppearance={setAppearance}
        onDone={finish}
      />
    );
  }

  return null;
}

export function OnboardingGate({ children }) {
  const { ready } = useStorage();
  const [complete, setComplete] = usePersistedState(ONBOARDING_COMPLETE_KEY, false);

  useEffect(() => {
    if (!ready || complete || isChromebookApp) return;
    if (isExistingAppUser()) {
      setComplete(true);
    }
  }, [ready, complete, setComplete]);

  if (isChromebookApp || shouldSkipOnboarding() || complete) {
    return children;
  }

  if (!ready) return null;

  return <OnboardingFlow onComplete={() => setComplete(true)} />;
}
