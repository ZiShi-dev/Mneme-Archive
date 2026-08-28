import { responseJson } from "./lib/response.js";
import { toPublicSourceError } from "./lib/errors.js";
import { handleAzoraRequest } from "./sources/azorafly.js";
import { handleGalaxyRequest } from "./sources/galaxynovels.js";
import { handleMangalikRequest } from "./sources/mangalik.js";
import { handleRealmNovelRequest } from "./sources/realmnovel.js";
import { handleNightNovelRequest } from "./sources/nightnovel.js";
import { handleNovelsParadiseRequest } from "./sources/novelsparadise.js";
import { handleCeneleRequest } from "./sources/cenele.js";
import { handleKolnovelRequest } from "./sources/kolnovel.js";
import { handleAnime4upRequest } from "./sources/anime4up.js";
import { handleFrenchStreamRequest } from "./sources/frenchstream.js";
import { handleWiflixRequest } from "./sources/wiflix.js";
import { handleDilarRequest } from "./sources/dilar.js";
import { handleMangaforfreeRequest } from "./sources/mangaforfree.js";
import { handleArabshentaiRequest } from "./sources/arabshentai.js";
import { handleHentaireadRequest } from "./sources/hentairead.js";
import { handleHentaigasmRequest } from "./sources/hentaigasm.js";

export async function handleSourceRequest(rawUrl) {
  const isMangaLik = rawUrl?.startsWith("/api/sources/mangalik/");
  const isAzora = rawUrl?.startsWith("/api/sources/azorafly/");
  const isGalaxy = rawUrl?.startsWith("/api/sources/galaxynovels/");
  const isParadise = rawUrl?.startsWith("/api/sources/novelsparadise/");
  const isNightNovel = rawUrl?.startsWith("/api/sources/nightnovel/");
  const isRealmNovel = rawUrl?.startsWith("/api/sources/realmnovel/");
  const isCenele = rawUrl?.startsWith("/api/sources/cenele/");
  const isKolnovel = rawUrl?.startsWith("/api/sources/kolnovel/");
  const isAnime4up = rawUrl?.startsWith("/api/sources/anime4up/");
  const isFrenchStream = rawUrl?.startsWith("/api/sources/frenchstream/");
  const isWiflix = rawUrl?.startsWith("/api/sources/wiflix/");
  const isMangaforfree = rawUrl?.startsWith("/api/sources/mangaforfree/");
  const isDilar = rawUrl?.startsWith("/api/sources/dilar/");
  const isArabshentai = rawUrl?.startsWith("/api/sources/arabshentai/");
  const isHentairead = rawUrl?.startsWith("/api/sources/hentairead/");
  const isHentaigasm = rawUrl?.startsWith("/api/sources/hentaigasm/");
  if (!isMangaLik && !isAzora && !isGalaxy && !isParadise && !isNightNovel && !isRealmNovel && !isCenele && !isKolnovel && !isAnime4up && !isFrenchStream && !isWiflix && !isMangaforfree && !isDilar && !isArabshentai && !isHentairead && !isHentaigasm) return null;
  try {
    const requestUrl = new URL(rawUrl, "http://localhost");
    if (isHentaigasm) return await handleHentaigasmRequest(requestUrl);
    if (isHentairead) return await handleHentaireadRequest(requestUrl);
    if (isArabshentai) return await handleArabshentaiRequest(requestUrl);
    if (isDilar) return await handleDilarRequest(requestUrl);
    if (isMangaforfree) return await handleMangaforfreeRequest(requestUrl);
    if (isWiflix) return await handleWiflixRequest(requestUrl);
    if (isFrenchStream) return await handleFrenchStreamRequest(requestUrl);
    if (isAnime4up) return await handleAnime4upRequest(requestUrl);
    if (isKolnovel) return await handleKolnovelRequest(requestUrl);
    if (isCenele) return await handleCeneleRequest(requestUrl);
    if (isRealmNovel) return await handleRealmNovelRequest(requestUrl);
    if (isNightNovel) return await handleNightNovelRequest(requestUrl);
    if (isParadise) return await handleNovelsParadiseRequest(requestUrl);
    if (isGalaxy) return await handleGalaxyRequest(requestUrl);
    if (isAzora) return await handleAzoraRequest(requestUrl);
    return await handleMangalikRequest(requestUrl);
  } catch (error) {
    return responseJson(502, { error: toPublicSourceError(error) });
  }
}
