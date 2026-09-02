import React from "react";
import { ALargeSmall, BookOpen, Check, ChevronLeft, Type } from "lucide-react";
import { SettingsSheet } from "../components/ui/SettingsSheet";
import { useI18n } from "../i18n/I18nProvider";
import {
  FONT_CLASSIC,
  FONT_KUFI,
  FONT_NASKH,
  FONT_SANS,
  TYPEFACES,
  typefaceHintKey,
  typefaceNameKey,
} from "../lib/theme/typeface";

const FONT_OPTIONS = [
  { id: FONT_SANS, Icon: Type },
  { id: FONT_NASKH, Icon: BookOpen },
  { id: FONT_KUFI, Icon: ALargeSmall },
  { id: FONT_CLASSIC, Icon: Type },
];

export function FontSelector({ typeface, onSetTypeface }) {
  const { t } = useI18n();
  return (
    <div className="theme-selector theme-selector--four font-selector" role="radiogroup" aria-label={t("settings.font")}>
      {FONT_OPTIONS.map(({ id, Icon }) => {
        const active = typeface === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            className={active ? "active" : ""}
            aria-checked={active}
            style={{ fontFamily: TYPEFACES[id].arabic }}
            onClick={() => onSetTypeface(id)}
          >
            <Icon size={19} />
            <span>
              <strong>{t(typefaceNameKey(id))}</strong>
              <small>{t(typefaceHintKey(id))}</small>
            </span>
            <Check size={16} />
          </button>
        );
      })}
    </div>
  );
}

export { FONT_OPTIONS };

export function FontSettingsSheet({ open, onClose, typeface, onSetTypeface }) {
  const { t } = useI18n();

  return (
    <SettingsSheet
      open={open}
      onClose={onClose}
      eyebrow={t("settings.appearance")}
      title={t("settings.pickFont")}
      titleId="font-sheet-title"
      closeLabel={t("settings.closeFont")}
      className="theme-sheet"
      footer={(
        <button type="button" className="notify-sheet__done" onClick={onClose}>
          {t("common.done")}
        </button>
      )}
    >
      <p className="notify-sheet__hint">{t("settings.fontHint")}</p>
      <FontSelector typeface={typeface} onSetTypeface={onSetTypeface} />
    </SettingsSheet>
  );
}

export function FontSettingsEntry({ typeface, onOpen }) {
  const { t } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Type size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.font")}</strong>
        <small>{t(typefaceNameKey(typeface))}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}
