import { getLocale, t } from "../i18n/runtime.js";
import { ALLOWED_SOURCE_IDS, DEFAULT_SOURCE_ID, isChromebookApp } from "./appFlavor.js";

export const MANGALIK_LOGO_URL = "https://io.mangalik.net/wp-content/app/lekmanganet/lekmanga.png";
export const AZORAFLY_LOGO_URL = "https://storage.azorafly.com/public/upload/2025/12/24/c925c7f3-2310-4e90-9b62-7fae04fe1c36.webp";
export const GALAXY_NOVELS_LOGO_URL = "https://galaxynovels.com/wp-content/uploads/2026/05/cropped-مجرة-الروايات-شفافة-192x192.png";
export const NOVELS_PARADISE_LOGO_URL = "https://novelsparadise.site/favicon.ico";
export const ANIMEDAR_LOGO_URL = "https://animedar.net/wp-content/uploads/2023/10/cropped-cropped-انمي-دار-180x180-1-150x150.png";
export const CENELE_LOGO_URL = "https://cenele.com/wp-content/uploads/2026/08/cropped-%D9%81%D8%B6%D8%A7%D8%A1-%D8%B1%D9%88%D8%A7%D9%8A%D8%A7%D8%AA-192x192.png";
export const KOLNOVEL_LOGO_URL = "https://kolnovel.com/wp-content/uploads/2026/07/cropped-%D8%A8%D8%AF%D9%88%D9%86-%D8%A7%D8%B3%D9%8596_20260720234820-1-192x192.png";
export const ANIME4UP_LOGO_URL = "https://4h.b9p2m6c.shop/wp-content/uploads/2019/03/Anime4up-Icon-1.png";
export const FRENCH_STREAM_LOGO_URL = "https://french-stream.one/apple-touch-icon.png";
export const WIFLIX_LOGO_URL = "https://www.wiflix.tv/static/templates/wiflixnew/images/favicon.png";
export const DILAR_LOGO_URL = "https://dilar.tube/favicon.ico";
export const WTR_LAB_LOGO_URL = "https://wtr-lab.com/assets/favicon/apple-touch-icon.png";
export const NOVELPHOENIX_LOGO_URL = "https://novelphoenix.com/apple-touch-icon.png?v=4.2";
export const REALM_NOVEL_LOGO_URL = "https://realmnovel.com/static/favicon-32.png";

export const sourceProfiles = {
  realmnovel: {
    id: "realmnovel",
    name: "Realm Novel",
    arabicName: "عالم الروايات",
    domain: "realmnovel.com",
    url: "https://realmnovel.com/",
    logo: REALM_NOVEL_LOGO_URL,
    initials: "RN",
    contentLabel: "روايات مترجمة",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
  mangalik: {
    id: "mangalik",
    name: "MangaLik",
    arabicName: "مانغا ليك",
    domain: "mangalik.net",
    url: "https://mangalik.net/",
    logo: MANGALIK_LOGO_URL,
    initials: "ML",
    contentLabel: "مانغا",
    contentTypes: ["manga"],
    languages: ["ar"],
  },
  azorafly: {
    id: "azorafly",
    name: "AzoraFly",
    arabicName: "أزورا فلاي",
    domain: "azorafly.com",
    url: "https://azorafly.com/",
    logo: AZORAFLY_LOGO_URL,
    initials: "AZ",
    contentLabel: "مانغا وروايات",
    contentTypes: ["manga", "novel"],
    languages: ["ar"],
  },
  galaxynovels: {
    id: "galaxynovels",
    name: "Galaxy Novels",
    arabicName: "مجرة الروايات",
    domain: "galaxynovels.com",
    url: "https://galaxynovels.com/",
    logo: GALAXY_NOVELS_LOGO_URL,
    initials: "GN",
    contentLabel: "روايات عربية مترجمة",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
  novelsparadise: {
    id: "novelsparadise",
    name: "Novels Paradise",
    arabicName: "جنة الروايات",
    domain: "novelsparadise.site",
    url: "https://novelsparadise.site/",
    logo: NOVELS_PARADISE_LOGO_URL,
    initials: "NP",
    contentLabel: "روايات",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
  animedar: {
    id: "animedar",
    name: "AnimeDar",
    arabicName: "انمي دار",
    domain: "animedar.net",
    url: "https://animedar.net/",
    logo: ANIMEDAR_LOGO_URL,
    initials: "AD",
    contentLabel: "أنمي مترجم",
    contentTypes: ["anime"],
    languages: ["ar"],
  },
  cenele: {
    id: "cenele",
    name: "Cenele",
    arabicName: "فضاء الروايات",
    domain: "cenele.com",
    url: "https://cenele.com/",
    logo: CENELE_LOGO_URL,
    initials: "CE",
    contentLabel: "روايات",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
  kolnovel: {
    id: "kolnovel",
    name: "Kol Novel",
    arabicName: "ملوك الروايات",
    domain: "kolnovel.com",
    url: "https://kolnovel.com/series/",
    logo: KOLNOVEL_LOGO_URL,
    initials: "KN",
    contentLabel: "روايات مترجمة",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
  anime4up: {
    id: "anime4up",
    name: "Anime4up",
    arabicName: "أنمي فور أب",
    domain: "4h.b9p2m6c.shop",
    url: "https://4h.b9p2m6c.shop/home8/",
    logo: ANIME4UP_LOGO_URL,
    initials: "A4",
    contentLabel: "أنمي مترجم",
    contentTypes: ["anime", "movie"],
    languages: ["ar"],
  },
  frenchstream: {
    id: "frenchstream",
    name: "French Stream",
    arabicName: "فرنش ستريم",
    domain: "french-stream.one",
    url: "https://french-stream.one/films/",
    logo: FRENCH_STREAM_LOGO_URL,
    initials: "FS",
    contentLabel: "أفلام ومسلسلات فرنسية",
    contentTypes: ["movie", "series"],
    languages: ["fr", "en"],
  },
  wiflix: {
    id: "wiflix",
    name: "Wiflix",
    arabicName: "ويفليكس",
    domain: "wiflix.tv",
    url: "https://www.wiflix.tv/",
    logo: WIFLIX_LOGO_URL,
    initials: "WX",
    contentLabel: "أفلام ومسلسلات فرنسية",
    contentTypes: ["movie", "series"],
    languages: ["fr", "en"],
  },
  dilar: {
    id: "dilar",
    name: "Dilar",
    arabicName: "ديلار",
    domain: "dilar.tube",
    url: "https://dilar.tube/",
    logo: DILAR_LOGO_URL,
    initials: "DL",
    contentLabel: "مانغا ومانهوا",
    contentTypes: ["manga"],
    languages: ["ar"],
  },
  wtrlab: {
    id: "wtrlab",
    name: "WTR-LAB",
    arabicName: "دبليو تي آر لاب",
    domain: "wtr-lab.com",
    url: "https://wtr-lab.com/en/library",
    logo: WTR_LAB_LOGO_URL,
    initials: "WL",
    contentLabel: "روايات MTL",
    contentTypes: ["novel"],
    languages: ["en"],
  },
  novelphoenix: {
    id: "novelphoenix",
    name: "Novel Phoenix",
    arabicName: "نوفل فينيكس",
    domain: "novelphoenix.com",
    url: "https://novelphoenix.com/",
    logo: NOVELPHOENIX_LOGO_URL,
    initials: "NP",
    contentLabel: "روايات إنجليزية",
    contentTypes: ["novel"],
    languages: ["en"],
  },
};

/** Sources retirées de l'app — données persistées nettoyées au démarrage. */
export const REMOVED_SOURCE_IDS = new Set([
  "skynovel",
  "donghuaar",
  "nightnovel",
  "coflix",
  "mangaforfree",
  "animesama",
  "manhwaread",
  "mangadistrict",
  "hentaigasm",
  "hentairead",
  "arabshentai",
]);

export function isKnownSourceId(sourceId) {
  if (!sourceId || REMOVED_SOURCE_IDS.has(sourceId)) return false;
  return Object.prototype.hasOwnProperty.call(sourceProfiles, sourceId);
}

export function sanitizeSourcesList(current) {
  const known = (Array.isArray(current) ? current : []).filter((entry) => isKnownSourceId(entry.id));
  return initialSources.map((fallback) => ({ ...fallback, ...(known.find((entry) => entry.id === fallback.id) || {}) }));
}

export function sanitizeActiveSourceId(sourceId, sourceList = initialSources) {
  if (isKnownSourceId(sourceId) && sourceList.some((entry) => entry.id === sourceId && entry.enabled !== false)) {
    return sourceId;
  }
  return sourceList.find((entry) => entry.enabled !== false && isKnownSourceId(entry.id))?.id || DEFAULT_SOURCE_ID;
}

const listedProfiles = (isChromebookApp && ALLOWED_SOURCE_IDS
  ? ALLOWED_SOURCE_IDS.map((id) => sourceProfiles[id]).filter(Boolean)
  : Object.values(sourceProfiles));

export const initialSources = listedProfiles.map((profile) => ({
  id: profile.id,
  name: profile.name,
  url: profile.url,
  status: "متصل",
  initials: profile.initials,
  logoUrl: profile.logo,
}));

export const initialSourcePreferences = Object.fromEntries(
  listedProfiles.map((profile) => [profile.id, { mode: "full", selectedItems: [] }]),
);

export function getSourceProfile(sourceId) {
  return sourceProfiles[sourceId] || sourceProfiles[DEFAULT_SOURCE_ID] || sourceProfiles.frenchstream;
}

export function getSourceDisplayName(sourceIdOrProfile, locale = getLocale()) {
  const profile = typeof sourceIdOrProfile === "string"
    ? getSourceProfile(sourceIdOrProfile)
    : sourceIdOrProfile || getSourceProfile();
  return locale === "ar" ? (profile.arabicName || profile.name) : profile.name;
}

export const SOURCE_LANGUAGE_LABELS = {
  ar: "العربية",
  fr: "الفرنسية",
  en: "الإنجليزية",
  ja: "اليابانية",
  ko: "الكورية",
  zh: "الصينية",
};

export function getSourceLanguageCodes(sourceIdOrProfile) {
  const profile = typeof sourceIdOrProfile === "string"
    ? getSourceProfile(sourceIdOrProfile)
    : sourceIdOrProfile || getSourceProfile();
  const codes = Array.isArray(profile.languages) ? profile.languages.filter(Boolean) : [];
  return codes.length ? codes : ["ar"];
}

export function getSourceLanguageLabels(sourceIdOrProfile) {
  return getSourceLanguageCodes(sourceIdOrProfile).map((code) => t(`language.${code}`) || SOURCE_LANGUAGE_LABELS[code] || code);
}

export function defaultVideoKinds(sourceId) {
  const profile = sourceProfiles[sourceId];
  if (!(profile?.contentTypes?.includes("movie") && profile.contentTypes?.includes("series"))) return [];
  const moviesPath = sourceId === "wiflix"
    ? "/film-en-streaming/"
    : "/films/";
  const seriesPath = sourceId === "wiflix"
    ? "/serie-en-streaming/"
    : "/s-tv/";
  return [
    { slug: "all", name: t("common.all"), filterPath: "/all/" },
    { slug: "movies", name: t("content.movie"), filterPath: moviesPath },
    { slug: "series", name: t("content.series"), filterPath: seriesPath },
  ];
}

export function enrichKindWithFilterPath(kind, sourceId) {
  if (!kind || kind.slug === "all" || kind.filterPath) return kind;
  const match = defaultContentKinds(sourceId).find((entry) => entry.slug === kind.slug);
  if (!match) return kind;
  return {
    ...kind,
    type: kind.type || match.type || "kind",
    ...(match.filterPath ? { filterPath: match.filterPath } : {}),
    ...(match.queryValue && !kind.queryValue ? { queryValue: match.queryValue } : {}),
  };
}

/** Sources sans filtre « الكل » : force un type par défaut. */
export function getDefaultCatalogKind(sourceId) {
  const kinds = defaultContentKinds(sourceId);
  if (!kinds.length || kinds.some((entry) => entry.slug === "all")) return null;
  return enrichKindWithFilterPath({ ...kinds[0], type: "kind" }, sourceId);
}

export function defaultContentKinds(sourceId) {
  const videoKinds = defaultVideoKinds(sourceId);
  if (videoKinds.length) return videoKinds;

  if (sourceId === "anime4up") {
    return [
      { slug: "all", name: "الكل", filterPath: "/all/" },
      { slug: "anime", name: "أنمي", filterPath: "/anime-type/tv2/" },
      { slug: "movies", name: "أفلام", filterPath: "/anime-type/movie/" },
    ];
  }

  if (sourceId === "animedar") {
    return [{ slug: "all", name: "الكل", filterPath: "/" }];
  }

  if (sourceId === "wtrlab") {
    return [
      { slug: "all", name: "الكل", type: "kind" },
      { slug: "popular", name: "الأكثر قراءة", type: "kind", queryValue: "popular" },
      { slug: "trending", name: "رائج", type: "kind", queryValue: "trending" },
      { slug: "latest", name: "الأحدث", type: "kind", queryValue: "latest" },
      { slug: "ongoing", name: "مستمر", type: "kind", queryValue: "ongoing" },
      { slug: "completed", name: "مكتمل", type: "kind", queryValue: "completed" },
      { slug: "ranking", name: "التصنيف", type: "kind", queryValue: "ranking" },
    ];
  }

  if (sourceId === "novelphoenix") {
    return [
      { slug: "all", name: "الكل", type: "kind" },
      { slug: "popular", name: "الأكثر شعبية", type: "kind", queryValue: "popular" },
      { slug: "updates", name: "التحديثات", type: "kind", queryValue: "updates" },
      { slug: "latest", name: "إصدارات حديثة", type: "kind", queryValue: "latest" },
      { slug: "ongoing", name: "مستمر", type: "kind", queryValue: "ongoing" },
      { slug: "completed", name: "مكتمل", type: "kind", queryValue: "completed" },
      { slug: "ranking", name: "التصنيف", type: "kind", queryValue: "ranking" },
    ];
  }

  const profile = sourceProfiles[sourceId];
  if (profile?.contentTypes?.includes("manga") && profile?.contentTypes?.includes("novel")) {
    return [
      { slug: "all", name: "الكل", filterPath: "/all/" },
      { slug: "manga", name: "مانغا", filterPath: "/all/" },
      { slug: "novel", name: "روايات", filterPath: "/all/" },
    ];
  }

  return [];
}

export function resolveSourceId(item) {
  if (item?.sourceId && REMOVED_SOURCE_IDS.has(item.sourceId)) return DEFAULT_SOURCE_ID;
  if (item?.sourceId) return item.sourceId;
  if (item?.source === "Realm Novel") return "realmnovel";
  if (item?.sourceId === "realmnovel") return "realmnovel";
  if (item?.source === "AzoraFly") return "azorafly";
  if (item?.source === "Galaxy Novels") return "galaxynovels";
  if (item?.source === "Novels Paradise") return "novelsparadise";
  if (item?.sourceId === "novelsparadise") return "novelsparadise";
  if (item?.source === "Night Novel") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "nightnovel") return DEFAULT_SOURCE_ID;
  if (item?.source === "Sky Novel") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "skynovel") return DEFAULT_SOURCE_ID;
  if (item?.source === "AnimeDar") return "animedar";
  if (item?.sourceId === "animedar") return "animedar";
  if (item?.source === "Cenele") return "cenele";
  if (item?.sourceId === "cenele") return "cenele";
  if (item?.source === "Kol Novel") return "kolnovel";
  if (item?.sourceId === "kolnovel") return "kolnovel";
  if (item?.source === "Anime4up") return "anime4up";
  if (item?.sourceId === "anime4up") return "anime4up";
  if (item?.source === "French Stream") return "frenchstream";
  if (item?.sourceId === "frenchstream") return "frenchstream";
  if (item?.source === "Wiflix") return "wiflix";
  if (item?.sourceId === "wiflix") return "wiflix";
  if (item?.source === "Coflix") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "coflix") return DEFAULT_SOURCE_ID;
  if (item?.source === "Dilar") return "dilar";
  if (item?.sourceId === "dilar") return "dilar";
  if (item?.source === "MangaForFree") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "mangaforfree") return DEFAULT_SOURCE_ID;
  if (item?.source === "Arabs Hentai") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "arabshentai") return DEFAULT_SOURCE_ID;
  if (item?.source === "HentaiRead") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "hentairead") return DEFAULT_SOURCE_ID;
  if (item?.source === "HentaiGasm") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "hentaigasm") return DEFAULT_SOURCE_ID;
  if (item?.source === "MangaDistrict") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "mangadistrict") return DEFAULT_SOURCE_ID;
  if (item?.source === "ManhwaRead") return DEFAULT_SOURCE_ID;
  if (item?.sourceId === "manhwaread") return DEFAULT_SOURCE_ID;
  if (item?.source === "WTR-LAB") return "wtrlab";
  if (item?.sourceId === "wtrlab") return "wtrlab";
  if (item?.source === "Novel Phoenix") return "novelphoenix";
  if (item?.sourceId === "novelphoenix") return "novelphoenix";
  return DEFAULT_SOURCE_ID;
}
