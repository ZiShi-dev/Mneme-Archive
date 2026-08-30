import { handleAzoraRequest } from "../sources/azorafly.js";
import { handleGalaxyRequest } from "../sources/galaxynovels.js";
import { handleMangalikRequest } from "../sources/mangalik.js";
import { handleMangaforfreeRequest } from "../sources/mangaforfree.js";
import { handleAnimedarRequest } from "../sources/animedar.js";
import { handleNovelsParadiseRequest } from "../sources/novelsparadise.js";
import { handleCeneleRequest } from "../sources/cenele.js";
import { handleKolnovelRequest } from "../sources/kolnovel.js";
import { handleAnime4upRequest } from "../sources/anime4up.js";
import { handleAnimesamaRequest } from "../sources/animesama.js";
import { handleFrenchStreamRequest } from "../sources/frenchstream.js";
import { handleWiflixRequest } from "../sources/wiflix.js";
import { handleCoflixRequest } from "../sources/coflix.js";
import { handleDilarRequest } from "../sources/dilar.js";
import { handleArabshentaiRequest } from "../sources/arabshentai.js";
import { handleHentaireadRequest } from "../sources/hentairead.js";
import { handleHentaigasmRequest } from "../sources/hentaigasm.js";
import { handleMangadistrictRequest } from "../sources/mangadistrict.js";
import { handleManhwareadRequest } from "../sources/manhwaread.js";
import { handleWtrlabRequest } from "../sources/wtrlab.js";
import { handleNovelphoenixRequest } from "../sources/novelphoenix.js";

/** @type {Record<string, (requestUrl: URL) => Promise<unknown>>} */
export const SOURCE_HANDLERS = Object.freeze({
  novelphoenix: handleNovelphoenixRequest,
  wtrlab: handleWtrlabRequest,
  manhwaread: handleManhwareadRequest,
  mangadistrict: handleMangadistrictRequest,
  hentaigasm: handleHentaigasmRequest,
  hentairead: handleHentaireadRequest,
  arabshentai: handleArabshentaiRequest,
  dilar: handleDilarRequest,
  wiflix: handleWiflixRequest,
  coflix: handleCoflixRequest,
  frenchstream: handleFrenchStreamRequest,
  anime4up: handleAnime4upRequest,
  animesama: handleAnimesamaRequest,
  kolnovel: handleKolnovelRequest,
  cenele: handleCeneleRequest,
  animedar: handleAnimedarRequest,
  novelsparadise: handleNovelsParadiseRequest,
  galaxynovels: handleGalaxyRequest,
  azorafly: handleAzoraRequest,
  mangaforfree: handleMangaforfreeRequest,
  mangalik: handleMangalikRequest,
});

export const SOURCE_ROUTE_ORDER = Object.freeze(Object.keys(SOURCE_HANDLERS));

const SOURCE_ROUTE_PATTERN = /^\/api\/sources\/([^/]+)\//;

export function resolveSourceHandler(rawUrl = "") {
  const match = String(rawUrl).match(SOURCE_ROUTE_PATTERN);
  if (!match) return null;
  return SOURCE_HANDLERS[match[1]] ?? null;
}

export function isKnownSourceRoute(rawUrl = "") {
  return Boolean(resolveSourceHandler(rawUrl));
}
