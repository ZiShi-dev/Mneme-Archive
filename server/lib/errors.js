const PUBLIC_SOURCE_ERROR = "المصدر غير متاح حالياً";

export function logSourceError(error, context = "manga-sources") {
  if (process.env.NODE_ENV === "production") return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context}]`, message);
}

export function toPublicSourceError(error) {
  logSourceError(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/[\u0600-\u06FF]/.test(message)) return message;
  return PUBLIC_SOURCE_ERROR;
}
