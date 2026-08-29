import { responseJson } from "./lib/response.js";
import { toPublicSourceError } from "./lib/errors.js";
import { handleAzoraRequest } from "./sources/azorafly.js";
import { handleGalaxyRequest } from "./sources/galaxynovels.js";
import { handleMangalikRequest } from "./sources/mangalik.js";
import { handleAnimedarRequest } from "./sources/animedar.js";
import { handleNightNovelRequest } from "./sources/nightnovel.js";
import { handleNovelsParadiseRequest } from "./sources/novelsparadise.js";
import { handleCeneleRequest } from "./sources/cenele.js";
import { handleKolnovelRequest } from "./sources/kolnovel.js";
import { handleAnime4upRequest } from "./sources/anime4up.js";
import { handleAnimesamaRequest } from "./sources/animesama.js";
import { handleFrenchStreamRequest } from "./sources/frenchstream.js";
import { handleWiflixRequest } from "./sources/wiflix.js";
import { handleCoflixRequest } from "./sources/coflix.js";
import { handleDilarRequest } from "./sources/dilar.js";
import { handleHentaireadRequest } from "./sources/hentairead.js";
import { handleWtrlabRequest } from "./sources/wtrlab.js";
import { handleNovelphoenixRequest } from "./sources/novelphoenix.js";

export async function handleSourceRequest(rawUrl) {
  const isMangaLik = rawUrl?.startsWith("/api/sources/mangalik/");
  const isAzora = rawUrl?.startsWith("/api/sources/azorafly/");
  const isGalaxy = rawUrl?.startsWith("/api/sources/galaxynovels/");
  const isParadise = rawUrl?.startsWith("/api/sources/novelsparadise/");
  const isNightNovel = rawUrl?.startsWith("/api/sources/nightnovel/");
  const isAnimedar = rawUrl?.startsWith("/api/sources/animedar/");
  const isCenele = rawUrl?.startsWith("/api/sources/cenele/");
  const isKolnovel = rawUrl?.startsWith("/api/sources/kolnovel/");
  const isAnime4up = rawUrl?.startsWith("/api/sources/anime4up/");
  const isAnimesama = rawUrl?.startsWith("/api/sources/animesama/");
  const isFrenchStream = rawUrl?.startsWith("/api/sources/frenchstream/");
  const isWiflix = rawUrl?.startsWith("/api/sources/wiflix/");
  const isCoflix = rawUrl?.startsWith("/api/sources/coflix/");
  const isDilar = rawUrl?.startsWith("/api/sources/dilar/");
  const isHentairead = rawUrl?.startsWith("/api/sources/hentairead/");
  const isWtrlab = rawUrl?.startsWith("/api/sources/wtrlab/");
  const isNovelphoenix = rawUrl?.startsWith("/api/sources/novelphoenix/");
  if (!isMangaLik && !isAzora && !isGalaxy && !isParadise && !isNightNovel && !isAnimedar && !isCenele && !isKolnovel && !isAnime4up && !isAnimesama && !isFrenchStream && !isWiflix && !isCoflix && !isDilar && !isHentairead && !isWtrlab && !isNovelphoenix) return null;
  try {
    const requestUrl = new URL(rawUrl, "http://localhost");
    if (isNovelphoenix) return await handleNovelphoenixRequest(requestUrl);
    if (isWtrlab) return await handleWtrlabRequest(requestUrl);
    if (isHentairead) return await handleHentaireadRequest(requestUrl);
    if (isDilar) return await handleDilarRequest(requestUrl);
    if (isWiflix) return await handleWiflixRequest(requestUrl);
    if (isCoflix) return await handleCoflixRequest(requestUrl);
    if (isFrenchStream) return await handleFrenchStreamRequest(requestUrl);
    if (isAnime4up) return await handleAnime4upRequest(requestUrl);
    if (isAnimesama) return await handleAnimesamaRequest(requestUrl);
    if (isKolnovel) return await handleKolnovelRequest(requestUrl);
    if (isCenele) return await handleCeneleRequest(requestUrl);
    if (isAnimedar) return await handleAnimedarRequest(requestUrl);
    if (isNightNovel) return await handleNightNovelRequest(requestUrl);
    if (isParadise) return await handleNovelsParadiseRequest(requestUrl);
    if (isGalaxy) return await handleGalaxyRequest(requestUrl);
    if (isAzora) return await handleAzoraRequest(requestUrl);
    return await handleMangalikRequest(requestUrl);
  } catch (error) {
    return responseJson(502, { error: toPublicSourceError(error) });
  }
}
