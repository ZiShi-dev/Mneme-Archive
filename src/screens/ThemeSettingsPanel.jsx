import React, { useEffect } from "react";
import { Check, ChevronLeft, Moon, Snowflake, Sun } from "lucide-react";
import { SheetCloseButton } from "../components/ui/SheetCloseButton";
import { SheetPortal } from "../components/ui/SheetPortal";
import { SakuraIcon } from "../components/atmosphere/SakuraIcon";
import { LuneNeigeThemePreview } from "../components/atmosphere/LuneNeigeThemePreview";
import { useI18n } from "../i18n/I18nProvider";
import {
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  themeHintKey,
  themeNameKey,
} from "../lib/theme/appearance";

const THEME_OPTIONS = [
  { id: THEME_INK, Icon: Moon },
  { id: THEME_PAPER, Icon: Sun },
  { id: THEME_SAKURA, Icon: SakuraIcon },
  { id: THEME_YOZAKURA, Icon: SakuraIcon },
  { id: THEME_LUNE_NEIGE, Icon: Snowflake },
];

function ThemeOptionIcon({ Icon }) {
  if (Icon === SakuraIcon) return <SakuraIcon size={19} decorative />;
  return <Icon size={19} />;
}

function ThemeSelector({ appearance, onSetAppearance }) {
  const { t } = useI18n();
  return (
    <div className="theme-selector theme-selector--five" role="group" aria-label={t("settings.appearance")}>
      {THEME_OPTIONS.map(({ id, Icon }) => {
        const active = appearance === id;
        return (
          <button
            key={id}
            type="button"
            className={[
              "theme-selector__option",
              active ? "active" : "",
              id === THEME_YOZAKURA ? "theme-selector__option--yozakura" : "",
              id === THEME_SAKURA ? "theme-selector__option--sakura" : "",
              id === THEME_LUNE_NEIGE ? "theme-selector__option--lune-neige" : "",
            ].filter(Boolean).join(" ")}
            aria-pressed={active}
            onClick={() => onSetAppearance(id)}
          >
            {id === THEME_LUNE_NEIGE ? <LuneNeigeThemePreview /> : null}
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
          appearance === THEME_LUNE_NEIGE ? "theme-sheet--lune-neige" : "",
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
