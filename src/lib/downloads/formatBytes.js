const UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes, locale = "fr") {
  const value = Number(bytes) || 0;
  if (value <= 0) return `0 ${UNITS[0]}`;
  const unitIndex = Math.min(UNITS.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / (1024 ** unitIndex);
  const digits = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[unitIndex]}`;
}

export function formatDataUsage(bytes, locale = "fr") {
  const value = Number(bytes) || 0;
  if (value <= 0) return `0 ${UNITS[0]}`;
  const gb = value / (1024 ** 3);
  if (gb >= 0.01) {
    const digits = gb >= 10 ? 1 : 2;
    return `${gb.toLocaleString(locale, { maximumFractionDigits: digits })} Go`;
  }
  const mb = value / (1024 ** 2);
  if (mb >= 0.1) {
    const digits = mb >= 10 ? 0 : 1;
    return `${mb.toLocaleString(locale, { maximumFractionDigits: digits })} Mo`;
  }
  return formatBytes(value, locale);
}
