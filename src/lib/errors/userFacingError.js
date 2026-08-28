import { t } from "../../i18n/runtime.js";

const SAFE_ERROR_PREFIXES = [
  "تعذر",
  "المصدر",
  "رابط",
  "حماية",
  "فصل مدفوع",
  "المصادر الحية",
  "نوع",
  "حجم",
  "Impossible",
  "Source",
  "Lien d'",
  "Lien ",
  "Protection",
  "Type d'",
  "Taille d'",
];

export function toUserFacingError(error, fallback) {
  const resolvedFallback = fallback || t("errors.unexpected");
  if (!(error instanceof Error)) return resolvedFallback;
  const message = error.message.trim();
  if (!message) return resolvedFallback;
  if (SAFE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) return message;
  return resolvedFallback;
}
