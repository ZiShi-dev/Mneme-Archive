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

function isCloudflareBlockedMessage(message = "") {
  return /cloudflare|cf-chl|just a moment|checking your browser|attention required|حماية.*تمنع/i.test(message);
}

export function toUserFacingError(error, fallback) {
  const resolvedFallback = fallback || t("errors.unexpected");
  if (!(error instanceof Error)) return resolvedFallback;
  const message = error.message.trim();
  if (!message) return resolvedFallback;
  if (isCloudflareBlockedMessage(message)) return t("errors.cloudflareBlocked");
  if (SAFE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) return message;
  return resolvedFallback;
}
