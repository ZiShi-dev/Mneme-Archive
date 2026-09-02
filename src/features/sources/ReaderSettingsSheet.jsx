import React, { useMemo } from "react";
import { AlignJustify, AlignRight, BookOpen, Check, Circle, Coffee, Minus, Moon, Pilcrow, Plus, RotateCcw, Sparkles, Sun, Type } from "lucide-react";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import { useI18n } from "../../i18n/I18nProvider";

const FONT_FAMILIES = {
  naskh: '"Noto Naskh Arabic", "Amiri", serif',
  sans: '"Alexandria", sans-serif',
  serif: '"Amiri", "Literata", serif',
};

const READING_PRESETS = [
  {
    id: "comfort",
    icon: Moon,
    prefs: {
      theme: "night",
      fontSize: 18,
      lineHeight: 1.9,
      fontFamily: "naskh",
      textAlign: "right",
      paragraphSpacing: 1.25,
      contentWidth: "normal",
    },
  },
  {
    id: "focus",
    icon: Circle,
    prefs: {
      theme: "black",
      fontSize: 20,
      lineHeight: 2.15,
      fontFamily: "naskh",
      textAlign: "right",
      paragraphSpacing: 1.25,
      contentWidth: "narrow",
    },
  },
  {
    id: "paper",
    icon: Coffee,
    prefs: {
      theme: "paper",
      fontSize: 19,
      lineHeight: 1.9,
      fontFamily: "serif",
      textAlign: "justify",
      paragraphSpacing: 1.25,
      contentWidth: "normal",
    },
  },
  {
    id: "compact",
    icon: BookOpen,
    prefs: {
      theme: "night",
      fontSize: 16,
      lineHeight: 1.65,
      fontFamily: "sans",
      textAlign: "right",
      paragraphSpacing: 0.85,
      contentWidth: "wide",
    },
  },
];

function prefsMatch(left, right) {
  return Object.keys(right).every((key) => left[key] === right[key]);
}

function ReaderSettingsPreview({ preferences }) {
  const { t } = useI18n();

  return (
    <div
      className={`reader-settings__preview reader-settings__preview--${preferences.theme} reader-settings__preview--width-${preferences.contentWidth}`}
      style={{
        fontSize: `${preferences.fontSize}px`,
        lineHeight: preferences.lineHeight,
        fontFamily: FONT_FAMILIES[preferences.fontFamily] || FONT_FAMILIES.naskh,
        textAlign: preferences.textAlign,
        "--reader-preview-para-gap": `${preferences.paragraphSpacing}em`,
      }}
    >
      <p>{t("reader.settings.previewLead")}</p>
      <p>{t("reader.settings.previewBody")}</p>
    </div>
  );
}

function ReaderSettingsSection({ title, children }) {
  return (
    <section className="reader-settings__section">
      <h3 className="reader-settings__section-title">{title}</h3>
      {children}
    </section>
  );
}

function ReaderSettingsGroup({ icon: Icon, title, hint, children }) {
  return (
    <div className="reader-settings__group">
      <div className="reader-settings__label">
        <Icon size={18} />
        <span>
          <strong>{title}</strong>
          <small>{hint}</small>
        </span>
      </div>
      {children}
    </div>
  );
}

export function ReaderSettingsSheet({ preferences, onChange, onClose, onReset }) {
  const { t } = useI18n();
  const update = (key, value) => onChange({ ...preferences, [key]: value });

  const themes = useMemo(() => ([
    { id: "night", label: t("reader.settings.themes.night"), icon: Moon },
    { id: "black", label: t("reader.settings.themes.black"), icon: Circle },
    { id: "paper", label: t("reader.settings.themes.paper"), icon: Coffee },
    { id: "light", label: t("reader.settings.themes.light"), icon: Sun },
  ]), [t]);

  const fonts = useMemo(() => ([
    { id: "naskh", label: t("reader.settings.fonts.naskh") },
    { id: "sans", label: t("reader.settings.fonts.sans") },
    { id: "serif", label: t("reader.settings.fonts.serif") },
  ]), [t]);

  const lineSpacingOptions = useMemo(() => ([
    { value: 1.65, label: t("reader.settings.spacingCompact") },
    { value: 1.9, label: t("reader.settings.spacingComfortable") },
    { value: 2.15, label: t("reader.settings.spacingWide") },
  ]), [t]);

  const paragraphSpacingOptions = useMemo(() => ([
    { value: 0.85, label: t("reader.settings.paraClose") },
    { value: 1.25, label: t("reader.settings.paraComfortable") },
    { value: 1.7, label: t("reader.settings.paraWide") },
  ]), [t]);

  const widthOptions = useMemo(() => ([
    { value: "narrow", label: t("reader.settings.widthNarrow") },
    { value: "normal", label: t("reader.settings.widthNormal") },
    { value: "wide", label: t("reader.settings.widthWide") },
  ]), [t]);

  const presets = useMemo(() => READING_PRESETS.map((preset) => ({
    ...preset,
    label: t(`reader.settings.presets.${preset.id}`),
    hint: t(`reader.settings.presets.${preset.id}Hint`),
    active: prefsMatch(preferences, preset.prefs),
  })), [preferences, t]);

  return (
    <SheetPortal>
      <div
        className="reader-settings-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          className={`reader-settings reader-settings--theme-${preferences.theme}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reader-settings-title"
        >
          <header>
            <div>
              <small>{t("reader.settings.eyebrow")}</small>
              <h2 id="reader-settings-title">{t("reader.settings.title")}</h2>
            </div>
            <SheetCloseButton onClick={onClose} label={t("reader.settings.closeAria")} />
          </header>

          <div className="reader-settings__preview-sticky">
            <div className="reader-settings__preview-head">
              <span>{t("reader.settings.livePreview")}</span>
              <strong>{t("reader.settings.px", { n: preferences.fontSize })}</strong>
            </div>
            <ReaderSettingsPreview preferences={preferences} />
          </div>

          <div className="reader-settings__body">
            <ReaderSettingsSection title={t("reader.settings.presetsTitle")}>
              <p className="reader-settings__section-hint">{t("reader.settings.presetsHint")}</p>
              <div className="reader-settings__presets" role="list">
                {presets.map(({ id, label, hint, icon: Icon, prefs, active }) => (
                  <button
                    key={id}
                    type="button"
                    role="listitem"
                    className={`reader-settings__preset${active ? " active" : ""}`}
                    onClick={() => onChange({ ...preferences, ...prefs })}
                    aria-pressed={active}
                    aria-label={`${label} — ${hint}`}
                  >
                    <i className="reader-settings__preset-icon" aria-hidden="true">
                      <Icon size={16} />
                    </i>
                    <span className="reader-settings__preset-copy">
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                    {active ? <Check size={15} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </ReaderSettingsSection>

            <ReaderSettingsSection title={t("reader.settings.appearance")}>
              <ReaderSettingsGroup
                icon={Moon}
                title={t("reader.settings.theme")}
                hint={t("reader.settings.appearanceHint")}
              >
                <div className="reader-theme-options">
                  {themes.map(({ id, label, icon: Icon }) => {
                    const active = preferences.theme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={[
                          "reader-theme-option",
                          `reader-theme-option--${id}`,
                          active ? "active" : "",
                        ].filter(Boolean).join(" ")}
                        onClick={() => update("theme", id)}
                        aria-pressed={active}
                      >
                        <i className={`reader-theme-preview reader-theme-preview--${id}`}>
                          <Icon size={16} />
                        </i>
                        <span>{label}</span>
                        <Check size={16} aria-hidden={!active} />
                      </button>
                    );
                  })}
                </div>
              </ReaderSettingsGroup>
            </ReaderSettingsSection>

            <ReaderSettingsSection title={t("reader.settings.typography")}>
              <ReaderSettingsGroup
                icon={Type}
                title={t("reader.settings.fontFamily")}
                hint={t("reader.settings.fontFamilyHint")}
              >
                <div className="reader-font-options">
                  {fonts.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      className={`reader-font-option--${font.id} ${preferences.fontFamily === font.id ? "active" : ""}`}
                      onClick={() => update("fontFamily", font.id)}
                      aria-pressed={preferences.fontFamily === font.id}
                    >
                      <span>{t("reader.settings.sampleText")}</span>
                      <small>{font.label}</small>
                    </button>
                  ))}
                </div>
              </ReaderSettingsGroup>

              <ReaderSettingsGroup
                icon={Type}
                title={t("reader.settings.fontSize")}
                hint={t("reader.settings.px", { n: preferences.fontSize })}
              >
                <div className="reader-settings__size-control">
                  <button
                    type="button"
                    className="reader-settings__size-step"
                    onClick={() => update("fontSize", Math.max(14, preferences.fontSize - 1))}
                    disabled={preferences.fontSize <= 14}
                    aria-label={t("reader.settings.decreaseTextAria")}
                  >
                    <Minus size={18} />
                  </button>
                  <div className="reader-settings__size-slider">
                    <input
                      type="range"
                      min={14}
                      max={28}
                      step={1}
                      value={preferences.fontSize}
                      onChange={(event) => update("fontSize", Number(event.target.value))}
                      aria-label={t("reader.settings.fontSize")}
                      aria-valuemin={14}
                      aria-valuemax={28}
                      aria-valuenow={preferences.fontSize}
                      aria-valuetext={t("reader.settings.px", { n: preferences.fontSize })}
                    />
                    <strong style={{ fontSize: `${Math.min(24, preferences.fontSize)}px` }}>
                      {t("reader.settings.sampleText")}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="reader-settings__size-step"
                    onClick={() => update("fontSize", Math.min(28, preferences.fontSize + 1))}
                    disabled={preferences.fontSize >= 28}
                    aria-label={t("reader.settings.increaseTextAria")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </ReaderSettingsGroup>

              <ReaderSettingsGroup
                icon={AlignJustify}
                title={t("reader.settings.lineSpacing")}
                hint={t("reader.settings.lineSpacingHint")}
              >
                <div className="reader-segmented">
                  {lineSpacingOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={preferences.lineHeight === option.value ? "active" : ""}
                      onClick={() => update("lineHeight", option.value)}
                      aria-pressed={preferences.lineHeight === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ReaderSettingsGroup>

              <ReaderSettingsGroup
                icon={Pilcrow}
                title={t("reader.settings.paragraphSpacing")}
                hint={t("reader.settings.paragraphSpacingHint")}
              >
                <div className="reader-segmented">
                  {paragraphSpacingOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={preferences.paragraphSpacing === option.value ? "active" : ""}
                      onClick={() => update("paragraphSpacing", option.value)}
                      aria-pressed={preferences.paragraphSpacing === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ReaderSettingsGroup>
            </ReaderSettingsSection>

            <ReaderSettingsSection title={t("reader.settings.layout")}>
              <ReaderSettingsGroup
                icon={AlignRight}
                title={t("reader.settings.textAlign")}
                hint={t("reader.settings.textAlignHint")}
              >
                <div className="reader-segmented reader-segmented--two">
                  <button
                    type="button"
                    className={preferences.textAlign === "right" ? "active" : ""}
                    onClick={() => update("textAlign", "right")}
                    aria-pressed={preferences.textAlign === "right"}
                  >
                    <AlignRight size={16} />
                    {t("reader.settings.alignRight")}
                  </button>
                  <button
                    type="button"
                    className={preferences.textAlign === "justify" ? "active" : ""}
                    onClick={() => update("textAlign", "justify")}
                    aria-pressed={preferences.textAlign === "justify"}
                  >
                    <AlignJustify size={16} />
                    {t("reader.settings.alignJustify")}
                  </button>
                </div>
              </ReaderSettingsGroup>

              <ReaderSettingsGroup
                icon={Sparkles}
                title={t("reader.settings.contentWidth")}
                hint={t("reader.settings.contentWidthHint")}
              >
                <div className="reader-segmented">
                  {widthOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={preferences.contentWidth === option.value ? "active" : ""}
                      onClick={() => update("contentWidth", option.value)}
                      aria-pressed={preferences.contentWidth === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </ReaderSettingsGroup>
            </ReaderSettingsSection>
          </div>

          <footer>
            <button type="button" onClick={onReset}>
              <RotateCcw size={16} />
              {t("reader.settings.reset")}
            </button>
            <button type="button" className="reader-settings__done" onClick={onClose}>
              {t("common.done")}
            </button>
          </footer>
        </section>
      </div>
    </SheetPortal>
  );
}
