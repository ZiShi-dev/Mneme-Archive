import React, { memo, useCallback } from "react";

import { Check, ChevronLeft, Moon, Snowflake, Sparkles, Sun } from "lucide-react";

import { SakuraIcon } from "../components/atmosphere/SakuraIcon";

import { SettingsSheet } from "../components/ui/SettingsSheet";

import { useSheetContentReady } from "../hooks/useSheetContentReady";

import { useI18n } from "../i18n/I18nProvider";

import {
  THEME_GALAXIE,
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  themeHintKey,
  themeNameKey,
  themeSheetModifier,
} from "../lib/theme/appearance";



const THEME_OPTIONS = [

  { id: THEME_PAPER, Icon: Sun, modifier: "paper" },

  { id: THEME_INK, Icon: Moon, modifier: "ink" },

  { id: THEME_SAKURA, Icon: SakuraIcon, modifier: "sakura" },

  { id: THEME_YOZAKURA, Icon: SakuraIcon, modifier: "yozakura" },

  { id: THEME_LUNE_NEIGE, Icon: Snowflake, modifier: "lune-neige" },

  { id: THEME_GALAXIE, Icon: Sparkles, modifier: "galaxie" },

];



function ThemeOptionIcon({ Icon }) {

  if (Icon === SakuraIcon) return <SakuraIcon size={19} decorative />;

  return <Icon size={19} />;

}



const ThemeGalleryOption = memo(function ThemeGalleryOption({ id, modifier, active, label, hint, onSelect }) {

  return (

    <button

      type="button"

      role="radio"

      className={[

        "theme-selector__option",

        `theme-selector__option--${modifier}`,

        active ? "active" : "",

      ].filter(Boolean).join(" ")}

      aria-checked={active}

      aria-label={`${label} — ${hint}`}

      onClick={() => onSelect(id)}

    >

      <div className="theme-selector__preview" aria-hidden="true">

        <span className={`theme-selector__preview-placeholder theme-selector__preview-placeholder--${modifier}`} />

      </div>

      <div className="theme-selector__meta">

        <span className="theme-selector__copy">

          <strong>{label}</strong>

          <small>{hint}</small>

        </span>

        <Check className="theme-selector__check" size={16} aria-hidden="true" />

      </div>

    </button>

  );

});



export function ThemeSelector({ appearance, onSetAppearance }) {

  const { t } = useI18n();

  const handleSelect = useCallback((id) => {

    onSetAppearance(id);

  }, [onSetAppearance]);



  return (

    <div className="theme-selector theme-selector--gallery" role="radiogroup" aria-label={t("settings.pickTheme")}>

      {THEME_OPTIONS.map(({ id, modifier }) => (

        <ThemeGalleryOption

          key={id}

          id={id}

          modifier={modifier}

          active={appearance === id}

          label={t(themeNameKey(id))}

          hint={t(themeHintKey(id))}

          onSelect={handleSelect}

        />

      ))}

    </div>

  );

}



function ThemeSelectorSkeleton() {

  return (

    <div className="theme-selector theme-selector--gallery theme-selector--gallery-skeleton" aria-hidden="true">

      {THEME_OPTIONS.map(({ id, modifier }) => (

        <div key={id} className={`theme-selector__option theme-selector__option--${modifier}`}>

          <div className="theme-selector__preview">

            <span className={`theme-selector__preview-placeholder theme-selector__preview-placeholder--${modifier}`} />

          </div>

          <div className="theme-selector__meta">

            <span className="theme-selector__skeleton-line theme-selector__skeleton-line--title" />

            <span className="theme-selector__skeleton-line theme-selector__skeleton-line--hint" />

          </div>

        </div>

      ))}

    </div>

  );

}



export function ThemeSettingsSheet({ open, onClose, appearance, onSetAppearance }) {

  const { t } = useI18n();

  const contentReady = useSheetContentReady(open, 160);

  const handleSelect = useCallback((id) => {

    onSetAppearance(id);

    onClose();

  }, [onSetAppearance, onClose]);



  return (

    <SettingsSheet

      open={open}

      onClose={onClose}

      eyebrow={t("settings.appearance")}

      title={t("settings.pickTheme")}

      titleId="theme-sheet-title"

      closeLabel={t("settings.closeTheme")}

      className={`theme-sheet theme-sheet--gallery theme-sheet--${themeSheetModifier(appearance)}`}

      footer={(

        <button type="button" className="notify-sheet__done" onClick={onClose}>

          {t("common.done")}

        </button>

      )}

    >

      <p className="theme-sheet__intro">{t("settings.pickThemeHint")}</p>

      {contentReady ? (

        <ThemeSelector appearance={appearance} onSetAppearance={handleSelect} />

      ) : (

        <ThemeSelectorSkeleton />

      )}

    </SettingsSheet>

  );

}



export function ThemeSettingsEntry({ appearance, onOpen }) {

  const { t } = useI18n();

  const active = THEME_OPTIONS.find((option) => option.id === appearance) || THEME_OPTIONS[1];



  return (

    <button type="button" className="setting-row" onClick={onOpen}>

      <span className="setting-row__icon">

        <ThemeOptionIcon Icon={active.Icon} />

      </span>

      <span className="setting-row__copy">

        <strong>{t("settings.appearance")}</strong>

        <small>{t(themeNameKey(appearance))}</small>

      </span>

      <ChevronLeft size={18} />

    </button>

  );

}


