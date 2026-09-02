import React from "react";
import { Check, ChevronLeft, Languages } from "lucide-react";
import { SettingsSheet } from "../components/ui/SettingsSheet";
import { useToast } from "../components/ui/ToastProvider";
import { useI18n } from "../i18n/I18nProvider";
import { t as runtimeT } from "../i18n/runtime";

export function LanguageSettingsEntry({ onOpen }) {
  const { t, locale, locales } = useI18n();
  return (
    <button type="button" className="setting-row" onClick={onOpen}>
      <span className="setting-row__icon"><Languages size={19} /></span>
      <span className="setting-row__copy">
        <strong>{t("settings.language")}</strong>
        <small>{locales[locale]?.nativeName}</small>
      </span>
      <ChevronLeft size={18} />
    </button>
  );
}

export function LanguageSettingsSheet({ open, onClose }) {
  const { t, locale, setLocale, locales } = useI18n();
  const { pushToast } = useToast();

  return (
    <SettingsSheet
      open={open}
      onClose={onClose}
      eyebrow={t("settings.display")}
      title={t("settings.language")}
      titleId="language-sheet-title"
      className="theme-sheet"
    >
      <div className="theme-selector" role="radiogroup" aria-label={t("settings.language")}>
        {Object.values(locales).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            className={locale === entry.id ? "active" : ""}
            aria-checked={locale === entry.id}
            onClick={() => {
              setLocale(entry.id);
              const toastKey = entry.id === "fr"
                ? "toast.languageFr"
                : entry.id === "en"
                  ? "toast.languageEn"
                  : "toast.languageAr";
              pushToast({
                type: "success",
                message: runtimeT(toastKey),
              });
              onClose();
            }}
          >
            <Languages size={19} />
            <span>
              <strong>{entry.nativeName}</strong>
              <small>{entry.id === "ar" ? t("settings.languageArHint") : entry.id === "en" ? t("settings.languageEnHint") : t("settings.languageFrHint")}</small>
            </span>
            <Check size={16} />
          </button>
        ))}
      </div>
    </SettingsSheet>
  );
}
