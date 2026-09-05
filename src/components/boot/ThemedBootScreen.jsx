import React, { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { AppMark } from "../brand/AppMark";
import { resolveMnemeMarkPalette } from "../../lib/brand/mnemeMarkPalettes.js";
import { applyAppearance, isDarkTheme, readBootAppearance, themeTextColor } from "../../lib/theme/appearance";

async function hideNativeSplash() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // Plugin optionnel.
  }
}

export function ThemedBootScreen({
  message,
  retryLabel,
  appearance,
  error = false,
  onRetry,
}) {
  const themeId = appearance ?? readBootAppearance();
  const palette = resolveMnemeMarkPalette("auto", themeId);
  const textColor = themeTextColor(themeId);
  const mutedColor = isDarkTheme(themeId) ? "#aab3c4" : "#656575";

  useEffect(() => {
    applyAppearance(themeId);
    void hideNativeSplash();
  }, [themeId]);

  return (
    <div
      className={`boot-screen${error ? " boot-screen--error" : ""}${isDarkTheme(themeId) ? "" : " boot-screen--light"}`}
      style={{
        "--boot-bg": palette.canvas,
        "--boot-fg": textColor,
        "--boot-muted": mutedColor,
        "--boot-star": palette.starGlow,
        background: palette.canvas,
        color: textColor,
      }}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="boot-screen__glow" aria-hidden="true" />
      <div className="boot-screen__stars" aria-hidden="true" />
      <div className="boot-screen__inner">
        <div className="boot-screen__mark-wrap">
          <div className="boot-screen__mark-ring" aria-hidden="true" />
          <AppMark
            size={72}
            variant="auto"
            appearance={themeId}
            className="boot-screen__mark"
            decorative
          />
        </div>
        {message ? <p>{message}</p> : null}
        {error && onRetry && retryLabel ? (
          <button type="button" className="boot-screen__retry" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
