const API_BASE = "http://62.171.141.197:5007";
const APP_VERSION = "1.2.0";
const APP_PACKAGE = "com.myapp.novels_sky";

const API_HEADERS = {
  accept: "application/json",
  "accept-language": "ar,en;q=0.8",
  "user-agent": "okhttp/4.12.0",
  "x-app-version": APP_VERSION,
  "x-app-package": APP_PACKAGE,
};

export async function fetchSkyJson(path, { method = "GET", body } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...API_HEADERS,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json().catch(() => ({}));
  if (data?.forceUpdate) {
    throw new Error(data.message || "يتطلب التطبيق تحديثاً من المتجر");
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || `Sky Novel API ${response.status}`);
  }
  return data;
}

function chapterParagraphs(raw = "") {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p).trim()).filter((p) => p.length > 1);
  }
  const text = String(raw).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  const stripped = text.replace(/<[^>]+>/g, "");
  return stripped
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1);
}

export function parseSkyChapterPayload(data, url) {
  const block = data?.data?.chapter ?? data?.data ?? data?.chapter ?? data;
  const title = block?.title ?? block?.name ?? block?.chapterTitle ?? "فصل";
  const content =
    block?.content ?? block?.text ?? block?.body ?? block?.chapterContent ?? block?.htmlContent ?? "";
  const paragraphs = chapterParagraphs(content);
  if (!paragraphs.length) throw new Error("تعذر استخراج محتوى الفصل من Sky Novel API");
  return {
    title: String(title),
    url,
    kind: "novel",
    paragraphs,
    pages: [],
  };
}

async function tryPaths(paths) {
  for (const path of paths) {
    try {
      const data = await fetchSkyJson(path);
      return data;
    } catch {
      // essayer la route suivante
    }
  }
  throw new Error("تعذر جلب الفصل من Sky Novel API");
}

export async function fetchSkyNovelChapters(novelId) {
  const data = await tryPaths([
    `/novels/${novelId}/chapters`,
    `/chapters/${novelId}`,
    `/chapters?novelId=${novelId}`,
  ]);
  const list = data?.data?.chapters ?? data?.data ?? data?.chapters ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchSkyChapter(novelId, chapterNumber, chapterUrl) {
  const data = await tryPaths([
    `/novels/${novelId}/chapter/${chapterNumber}`,
    `/chapter/${novelId}/${chapterNumber}`,
    `/chapters/${novelId}/${chapterNumber}`,
    `/chapter/${novelId}/chapter/${chapterNumber}`,
  ]);
  return parseSkyChapterPayload(data, chapterUrl);
}
