import React, { useEffect } from "react";
import { Check, ChevronLeft, Moon, Snowflake, Sparkles, Sun } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { SakuraIcon } from "../components/atmosphere/SakuraIcon";
import { LuneNeigeThemePreview } from "../components/atmosphere/LuneNeigeThemePreview";
import { YozakuraThemePreview } from "../components/atmosphere/YozakuraThemePreview";
import { GalaxyThemePreview } from "../components/atmosphere/GalaxyAtmosphere";
import {
  SakuraDayThemePreview,
  InkThemePreview,
  PaperThemePreview,
} from "../components/atmosphere/CoreThemePreviews";
import { useI18n } from "../i18n/I18nProvider";
import {
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  THEME_GALAXIE,
  themeHintKey,
  themeNameKey,
} from "../lib/theme/appearance";

const THEME_OPTIONS = [
  { id: THEME_PAPER, Icon: Sun },
  { id: THEME_INK, Icon: Moon },
  { id: THEME_SAKURA, Icon: SakuraIcon },
  { id: THEME_YOZAKURA, Icon: SakuraIcon },
  { id: THEME_LUNE_NEIGE, Icon: Snowflake },
  { id: THEME_GALAXIE, Icon: Sparkles },
];

function ThemeOptionIcon({ Icon }) {
  if (Icon === SakuraIcon) return <SakuraIcon size={19} decorative />;
  return <Icon size={19} />;
}

function ThemeOptionPreview({ id }) {
  if (id === THEME_INK) return <InkThemePreview />;
  if (id === THEME_PAPER) return <PaperThemePreview />;
  if (id === THEME_SAKURA) return <SakuraDayThemePreview />;
  if (id === THEME_YOZAKURA) return <YozakuraThemePreview />;
  if (id === THEME_LUNE_NEIGE) return <LuneNeigeThemePreview />;
  if (id === THEME_GALAXIE) return <GalaxyThemePreview />;
  return null;
}

export function ThemeSelector({ appearance, onSetAppearance }) {
  const { t } = useI18n();
  return (
    <div className="theme-selector theme-selector--gallery" role="group" aria-label={t("settings.appearance")}>
      {THEME_OPTIONS.map(({ id, Icon }) => {
        const active = appearance === id;
        return (
          <button
            key={id}
            type="button"
            className={[
              "theme-selector__option",
              active ? "active" : "",
              id === THEME_INK ? "theme-selector__option--ink" : "",
              id === THEME_PAPER ? "theme-selector__option--paper" : "",
              id === THEME_YOZAKURA ? "theme-selector__option--yozakura" : "",
              id === THEME_SAKURA ? "theme-selector__option--sakura" : "",
              id === THEME_LUNE_NEIGE ? "theme-selector__option--lune-neige" : "",
              id === THEME_GALAXIE ? "theme-selector__option--galaxie" : "",
            ].filter(Boolean).join(" ")}
            aria-pressed={active}
            onClick={() => onSetAppearance(id)}
          >
            <ThemeOptionPreview id={id} />
            <ThemeOptionIcon Icon={Icon} />
            <span>
              <strong>{t(themeNameKey(id))}</strong>
              <small>{t(themeHintKey(id))}</small>
            </span>
            <Check size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function ThemeSettingsSheet({ open, onClose, appearance, onSetAppearance }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

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
        className={[
          "notify-sheet",
          "theme-sheet",
          "theme-sheet--gallery",
          appearance === THEME_LUNE_NEIGE ? "theme-sheet--lune-neige" : "",
          appearance === THEME_YOZAKURA ? "theme-sheet--yozakura" : "",
          appearance === THEME_GALAXIE ? "theme-sheet--galaxie" : "",
        ].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-sheet-title"
      >
        <header>
          <div>
            <small>{t("settings.appearance")}</small>
            <h2 id="theme-sheet-title">{t("settings.pickTheme")}</h2>
          </div>
          <SheetCloseButton onClick={onClose} label={t("settings.closeTheme")} />
        </header>

        <div className="notify-sheet__body">
          <ThemeSelector appearance={appearance} onSetAppearance={onSetAppearance} />
        </div>

        <footer>
          <button type="button" className="notify-sheet__done" onClick={onClose}>{t("common.done")}</button>
        </footer>
      </section>
    </div>
    </SheetPortal>
  );
}

export function ThemeSettingsEntry({ appearance, onOpen }) {
  const { t } = useI18n();
  const ActiveIcon = THEME_OPTIONS.find((option) => option.id === appearance)?.Icon || Moon;
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon">
        <ThemeOptionIcon Icon={ActiveIcon} />
      </span>
      <span className="setting-row__copy">
        <strong>{t("settings.appearance")}</strong>
        <small>{t(themeNameKey(appearance))} · {t(themeHintKey(appearance))}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}
