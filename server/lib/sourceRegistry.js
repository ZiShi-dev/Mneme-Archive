import { handleAzoraRequest } from "../sources/azorafly.js";
import { handleGalaxyRequest } from "../sources/galaxynovels.js";
import { handleMangalikRequest } from "../sources/mangalik.js";
import { handleAnimedarRequest } from "../sources/animedar.js";
import { handleNovelsParadiseRequest } from "../sources/novelsparadise.js";
import { handleCeneleRequest } from "../sources/cenele.js";
import { handleKolnovelRequest } from "../sources/kolnovel.js";
import { handleAnime4upRequest } from "../sources/anime4up.js";
import { handleFrenchStreamRequest } from "../sources/frenchstream.js";
import { handleWiflixRequest } from "../sources/wiflix.js";
import { handleDilarRequest } from "../sources/dilar.js";
import { handleWtrlabRequest } from "../sources/wtrlab.js";
import { handleNovelphoenixRequest } from "../sources/novelphoenix.js";
import { handleRealmNovelRequest } from "../sources/realmnovel.js";

/** @type {Record<string, (requestUrl: URL) => Promise<unknown>>} */
export const SOURCE_HANDLERS = Object.freeze({
  realmnovel: handleRealmNovelRequest,
  novelphoenix: handleNovelphoenixRequest,
  wtrlab: handleWtrlabRequest,
  dilar: handleDilarRequest,
  wiflix: handleWiflixRequest,
  frenchstream: handleFrenchStreamRequest,
  anime4up: handleAnime4upRequest,
  kolnovel: handleKolnovelRequest,
  cenele: handleCeneleRequest,
  animedar: handleAnimedarRequest,
  novelsparadise: handleNovelsParadiseRequest,
  galaxynovels: handleGalaxyRequest,
  azorafly: handleAzoraRequest,
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
