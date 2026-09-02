import React, { memo, useCallback, useMemo } from "react";
import { Check, Moon, Snowflake, Sparkles, Sun } from "lucide-react";

import { GalaxyThemePreview } from "../atmosphere/GalaxyAtmosphere";
import {
  InkThemePreview,
  PaperThemePreview,
  SakuraDayThemePreview,
} from "../atmosphere/CoreThemePreviews";
import { LuneNeigeThemePreview } from "../atmosphere/LuneNeigeThemePreview";
import { YozakuraThemePreview } from "../atmosphere/YozakuraThemePreview";
import { SakuraIcon } from "../atmosphere/SakuraIcon";
import { useI18n } from "../../i18n/I18nProvider";
import {
  THEME_GALAXIE,
  THEME_INK,
  THEME_LUNE_NEIGE,
  THEME_PAPER,
  THEME_SAKURA,
  THEME_YOZAKURA,
  themeHintKey,
  themeNameKey,
} from "../../lib/theme/appearance";

const THEME_PREVIEW = {
  [THEME_PAPER]: PaperThemePreview,
  [THEME_SAKURA]: SakuraDayThemePreview,
  [THEME_INK]: InkThemePreview,
  [THEME_YOZAKURA]: YozakuraThemePreview,
  [THEME_LUNE_NEIGE]: LuneNeigeThemePreview,
  [THEME_GALAXIE]: GalaxyThemePreview,
};

const THEME_GROUPS = [
  {
    id: "light",
    labelKey: "onboarding.themeGroupLight",
    themes: [
      { id: THEME_PAPER, Icon: Sun },
      { id: THEME_SAKURA, Icon: SakuraIcon },
    ],
  },
  {
    id: "dark",
    labelKey: "onboarding.themeGroupDark",
    themes: [
      { id: THEME_INK, Icon: Moon },
      { id: THEME_YOZAKURA, Icon: SakuraIcon },
      { id: THEME_LUNE_NEIGE, Icon: Snowflake },
      { id: THEME_GALAXIE, Icon: Sparkles },
    ],
  },
];

function ThemeOptionIcon({ Icon }) {
  if (Icon === SakuraIcon) return <SakuraIcon size={16} decorative />;
  return <Icon size={16} />;
}

const ThemeChip = memo(function ThemeChip({ id, Icon, active, label, hint, onSelect }) {
  const Preview = THEME_PREVIEW[id];

  return (
    <button
      type="button"
      role="radio"
      className={`onboarding__theme-chip${active ? " is-active" : ""}`}
      aria-checked={active}
      aria-label={`${label} — ${hint}`}
      onClick={() => onSelect(id)}
    >
      <div className="onboarding__theme-chip-preview" aria-hidden="true">
        {Preview ? <Preview /> : null}
      </div>
      <span className="onboarding__theme-chip-copy">
        <ThemeOptionIcon Icon={Icon} />
        <span>
          <strong>{label}</strong>
          <small>{hint}</small>
        </span>
      </span>
      {active ? (
        <span className="onboarding__theme-chip-badge">
          <Check size={12} aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
});

export function OnboardingThemePicker({ appearance, onSetAppearance }) {
  const { t } = useI18n();
  const Preview = useMemo(() => THEME_PREVIEW[appearance] || InkThemePreview, [appearance]);

  const handleSelect = useCallback((id) => {
    onSetAppearance(id);
  }, [onSetAppearance]);

  return (
    <div className="onboarding__theme-picker">
      <div className="onboarding__theme-preview" aria-live="polite" aria-atomic="true">
        <small>{t("onboarding.themePreviewLabel")}</small>
        <div className="onboarding__theme-preview-frame" key={appearance}>
          <div className="onboarding__theme-preview-scene">
            <Preview />
          </div>
          <div className="onboarding__theme-preview-ui">
            <div className="onboarding__theme-preview-card">
              <span className="onboarding__theme-preview-card-kicker">{t("onboarding.themePreviewKicker")}</span>
              <span className="onboarding__theme-preview-card-title">{t(themeNameKey(appearance))}</span>
              <span className="onboarding__theme-preview-card-sub">{t("onboarding.fontSampleFr")}</span>
            </div>
          </div>
        </div>
        <p className="onboarding__theme-preview-hint">{t(themeHintKey(appearance))}</p>
      </div>

      <div className="onboarding__theme-groups" role="radiogroup" aria-label={t("onboarding.themeTitle")}>
        {THEME_GROUPS.map((group) => (
          <section key={group.id} className="onboarding__theme-group">
            <h2 className="onboarding__theme-group-label">{t(group.labelKey)}</h2>
            <div className="onboarding__theme-chips">
              {group.themes.map(({ id, Icon }) => (
                <ThemeChip
                  key={id}
                  id={id}
                  Icon={Icon}
                  active={appearance === id}
                  label={t(themeNameKey(id))}
                  hint={t(themeHintKey(id))}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
