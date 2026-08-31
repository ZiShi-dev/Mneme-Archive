const API_BASE = process.env.SKYNOVEL_API_BASE || "http://62.171.141.197:5007";
/** Serveur Sky Novel refuse toute version < 10.0.0 (HTTP 426 forceUpdate). */
const APP_VERSION = process.env.SKYNOVEL_APP_VERSION || "10.0.0";
const APP_PACKAGE = "com.myapp.novels_sky";
const CHAPTERS_PAGE_SIZE = 100;
const CHAPTERS_MAX_PAGES = 50;

const API_HEADERS = {
  accept: "application/json",
  "accept-language": "ar,en;q=0.8",
  "user-agent": "okhttp/4.12.0",
  "x-app-version": APP_VERSION,
  "x-app-package": APP_PACKAGE,
};

function resolveSkyApiUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw new Error("مسار Sky Novel API غير صالح");
  }
  return `${API_BASE.replace(/\/+$/, "")}${path}`;
}

export async function fetchSkyJson(path, { method = "GET", body } = {}) {
  const url = resolveSkyApiUrl(path);
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

function normalizeSkyChapterList(data) {
  const list = data?.data?.chapters ?? data?.data ?? data?.chapters ?? [];
  return Array.isArray(list) ? list : [];
}

export async function fetchSkyNovelChapters(novelId) {
  const encoded = encodeURIComponent(novelId);
  const all = [];
  const seen = new Set();

  for (let page = 1; page <= CHAPTERS_MAX_PAGES; page += 1) {
    const data = await fetchSkyJson(`/novels/${encoded}/chapters?page=${page}`);
    const list = normalizeSkyChapterList(data);
    if (!list.length) break;

    for (const entry of list) {
      const key = String(entry?._id || entry?.id || entry?.chapterNumber || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(entry);
    }

    if (list.length < CHAPTERS_PAGE_SIZE) break;
  }

  return all;
}

export async function fetchSkyChapter(novelId, chapterNumber, chapterUrl) {
  const data = await fetchSkyJson(`/novels/${encodeURIComponent(novelId)}/chapters/${Number(chapterNumber)}`);
  return parseSkyChapterPayload(data, chapterUrl);
}
