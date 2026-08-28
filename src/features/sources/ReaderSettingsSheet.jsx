import React, { useMemo } from "react";
import { AlignJustify, AlignRight, Check, Coffee, Minus, Moon, Pilcrow, Plus, RotateCcw, Sun, Type } from "lucide-react";
import { SheetCloseButton } from "../../components/ui/SheetCloseButton";
import { SheetPortal } from "../../components/ui/SheetPortal";
import { useI18n } from "../../i18n/I18nProvider";

export function ReaderSettingsSheet({ preferences, onChange, onClose, onReset }) {
  const { t } = useI18n();
  const update = (key, value) => onChange({ ...preferences, [key]: value });

  const themes = useMemo(() => ([
    { id: "night", label: t("reader.settings.themes.night"), icon: Moon },
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

  return (
    <SheetPortal>
    <div className="reader-settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="reader-settings" role="dialog" aria-modal="true" aria-labelledby="reader-settings-title">
        <header><div><small>{t("reader.settings.eyebrow")}</small><h2 id="reader-settings-title">{t("reader.settings.title")}</h2></div><SheetCloseButton onClick={onClose} label={t("reader.settings.closeAria")} /></header>

        <div className="reader-settings__body">
          <div className="reader-settings__group"><div className="reader-settings__label"><Moon size={16} /><span><strong>{t("reader.settings.appearance")}</strong><small>{t("reader.settings.appearanceHint")}</small></span></div><div className="reader-theme-options">{themes.map(({ id, label, icon: Icon }) => <button key={id} className={preferences.theme === id ? "active" : ""} onClick={() => update("theme", id)} aria-pressed={preferences.theme === id}><i className={`reader-theme-preview reader-theme-preview--${id}`}><Icon size={15} /></i><span>{label}</span>{preferences.theme === id && <Check size={14} />}</button>)}</div></div>

          <div className="reader-settings__group"><div className="reader-settings__label"><Type size={16} /><span><strong>{t("reader.settings.fontSize")}</strong><small>{t("reader.settings.px", { n: preferences.fontSize })}</small></span></div><div className="reader-stepper"><button onClick={() => update("fontSize", Math.max(14, preferences.fontSize - 1))} disabled={preferences.fontSize <= 14} aria-label={t("reader.settings.decreaseTextAria")}><Minus size={17} /><span>{t("reader.settings.smaller")}</span></button><strong style={{ fontSize: `${Math.min(24, preferences.fontSize)}px` }}>{t("reader.settings.sampleText")}</strong><button onClick={() => update("fontSize", Math.min(28, preferences.fontSize + 1))} disabled={preferences.fontSize >= 28} aria-label={t("reader.settings.increaseTextAria")}><Plus size={17} /><span>{t("reader.settings.bigger")}</span></button></div></div>
          <div className="reader-settings__group"><div className="reader-settings__label"><AlignJustify size={16} /><span><strong>{t("reader.settings.lineSpacing")}</strong><small>{t("reader.settings.lineSpacingHint")}</small></span></div><div className="reader-segmented">{lineSpacingOptions.map((option) => <button key={option.value} className={preferences.lineHeight === option.value ? "active" : ""} onClick={() => update("lineHeight", option.value)} aria-pressed={preferences.lineHeight === option.value}>{option.label}</button>)}</div></div>
          <div className="reader-settings__group"><div className="reader-settings__label"><Type size={16} /><span><strong>{t("reader.settings.fontFamily")}</strong><small>{t("reader.settings.fontFamilyHint")}</small></span></div><div className="reader-font-options">{fonts.map((font) => <button key={font.id} className={`reader-font-option--${font.id} ${preferences.fontFamily === font.id ? "active" : ""}`} onClick={() => update("fontFamily", font.id)} aria-pressed={preferences.fontFamily === font.id}><span>{t("reader.settings.sampleText")}</span><small>{font.label}</small></button>)}</div></div>
          <div className="reader-settings__group"><div className="reader-settings__label"><AlignRight size={16} /><span><strong>{t("reader.settings.textAlign")}</strong><small>{t("reader.settings.textAlignHint")}</small></span></div><div className="reader-segmented reader-segmented--two"><button className={preferences.textAlign === "right" ? "active" : ""} onClick={() => update("textAlign", "right")} aria-pressed={preferences.textAlign === "right"}><AlignRight size={15} /> {t("reader.settings.alignRight")}</button><button className={preferences.textAlign === "justify" ? "active" : ""} onClick={() => update("textAlign", "justify")} aria-pressed={preferences.textAlign === "justify"}><AlignJustify size={15} /> {t("reader.settings.alignJustify")}</button></div></div>
          <div className="reader-settings__group"><div className="reader-settings__label"><Pilcrow size={16} /><span><strong>{t("reader.settings.paragraphSpacing")}</strong><small>{t("reader.settings.paragraphSpacingHint")}</small></span></div><div className="reader-segmented">{paragraphSpacingOptions.map((option) => <button key={option.value} className={preferences.paragraphSpacing === option.value ? "active" : ""} onClick={() => update("paragraphSpacing", option.value)} aria-pressed={preferences.paragraphSpacing === option.value}>{option.label}</button>)}</div></div>
          <div className="reader-settings__group"><div className="reader-settings__label"><AlignJustify size={16} /><span><strong>{t("reader.settings.contentWidth")}</strong><small>{t("reader.settings.contentWidthHint")}</small></span></div><div className="reader-segmented">{widthOptions.map((option) => <button key={option.value} className={preferences.contentWidth === option.value ? "active" : ""} onClick={() => update("contentWidth", option.value)} aria-pressed={preferences.contentWidth === option.value}>{option.label}</button>)}</div></div>
        </div>

        <footer><button onClick={onReset}><RotateCcw size={15} /> {t("reader.settings.reset")}</button><button className="reader-settings__done" onClick={onClose}>{t("common.done")}</button></footer>
      </section>
    </div>
    </SheetPortal>
  );
}
