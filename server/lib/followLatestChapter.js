import { responseJson } from "./responseJson.js";

export function pickLatestChapter(chapters = []) {
  if (!Array.isArray(chapters) || !chapters.length) return null;
  return chapters.reduce((best, chapter) => {
    const number = Number(chapter?.number ?? chapter?.name) || 0;
    const bestNumber = Number(best?.number ?? best?.name) || 0;
    if (!best || number >= bestNumber) return chapter;
    return best;
  }, chapters[0]);
}

export function slimDetailsForFollow(details = {}) {
  const latest = pickLatestChapter(details.chapters);
  return {
    title: details.title,
    altTitle: details.altTitle,
    cover: details.cover,
    url: details.url,
    sourceId: details.sourceId,
    source: details.source,
    mediaType: details.mediaType,
    mediaTypeLabel: details.mediaTypeLabel,
    chapters: latest ? [latest] : [],
  };
}

export async function handleFollowLatestRequest(requestUrl, request, sourceHandler) {
  const direct = await sourceHandler(requestUrl, request);
  if (direct.status !== 404) return direct;

  const fallbackUrl = new URL(requestUrl);
  fallbackUrl.pathname = fallbackUrl.pathname.replace(/\/follow-latest$/, "/manga");
  const mangaResult = await sourceHandler(fallbackUrl, request);
  if (mangaResult.status !== 200) return mangaResult;
  return responseJson(200, slimDetailsForFollow(mangaResult.body));
}
