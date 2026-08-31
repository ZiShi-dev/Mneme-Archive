const PUBLIC_SOURCE_ERROR = "المصدر غير متاح حالياً";
const CLOUDFLARE_PUBLIC_ERROR = "حماية Cloudflare منعت الاتصال مؤقتًا، أعد المحاولة بعد قليل";

export function logSourceError(error, context = "manga-sources") {
  if (process.env.NODE_ENV === "production") return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context}]`, message);
}

function isFlareOrCloudflareMessage(message = "") {
  return /cloudflare|FlareSolverr|Night-Novel|Challenge|bad gateway|surchargé|Trop de requêtes|tab crashed|Chrome a planté|n'a pas répondu à temps/i
    .test(String(message || ""));
}

export function toPublicSourceError(error) {
  logSourceError(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/[\u0600-\u06FF]/.test(message)) return message;
  if (isFlareOrCloudflareMessage(message)) return CLOUDFLARE_PUBLIC_ERROR;
  return PUBLIC_SOURCE_ERROR;
}
