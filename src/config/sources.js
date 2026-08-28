import { getLocale, t } from "../i18n/runtime.js";

export const MANGALIK_LOGO_URL = "https://io.mangalik.net/wp-content/app/lekmanganet/lekmanga.png";
export const AZORAFLY_LOGO_URL = "https://storage.azorafly.com/public/upload/2025/12/24/c925c7f3-2310-4e90-9b62-7fae04fe1c36.webp";
export const GALAXY_NOVELS_LOGO_URL = "https://galaxynovels.com/wp-content/uploads/2026/05/cropped-مجرة-الروايات-شفافة-192x192.png";
export const NOVELS_PARADISE_LOGO_URL = "https://novelsparadise.site/favicon.ico";
export const NIGHT_NOVEL_LOGO_URL = "https://nightnovelapp.tech/open-book.svg";
export const REALM_NOVEL_LOGO_URL = "https://realmnovel.com/static/favicon-32.png";
export const CENELE_LOGO_URL = "https://cenele.com/wp-content/uploads/2026/08/cropped-%D9%81%D8%B6%D8%A7%D8%A1-%D8%B1%D9%88%D8%A7%D9%8A%D8%A7%D8%AA-192x192.png";
export const KOLNOVEL_LOGO_URL = "https://kolnovel.com/wp-content/uploads/2026/07/cropped-%D8%A8%D8%AF%D9%88%D9%86-%D8%A7%D8%B3%D9%8596_20260720234820-1-192x192.png";
export const ANIME4UP_LOGO_URL = "https://4h.b9p2m6c.shop/wp-content/uploads/2019/03/Anime4up-Icon-1.png";
export const MANGAFORFREE_LOGO_URL = "https://mangaforfree.com/wp-content/uploads/2026/07/Site-Icon-mangaforfree.png";
export const FRENCH_STREAM_LOGO_URL = "https://french-stream.one/apple-touch-icon.png";
export const WIFLIX_LOGO_URL = "https://www.wiflix.tv/static/templates/wiflixnew/images/favicon.png";
export const DILAR_LOGO_URL = "https://dilar.tube/favicon.ico";
export const ARABS_HENTAI_LOGO_URL = "https://arabshentai.com/wp-content/themes/dooplay/assets/img/brand/arbs_logo_dark.webp";
export const HENTAIREAD_LOGO_URL = "https://hentairead.com/favicon.ico";
export const HENTAIGASM_LOGO_URL = "https://hentaigasm.com/favicon.ico";

export const sourceProfiles = {
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
  mangaforfree: {
    id: "mangaforfree",
    name: "MangaForFree",
    arabicName: "مانغا فور فري",
    domain: "mangaforfree.com",
    url: "https://mangaforfree.com/manga/",
    logo: MANGAFORFREE_LOGO_URL,
    initials: "MF",
    contentLabel: "مانغا ومانهوا",
    contentTypes: ["manga"],
    languages: ["en"],
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
  nightnovel: {
    id: "nightnovel",
    name: "Night Novel",
    arabicName: "روايات الليل",
    domain: "nightnovelapp.tech",
    url: "https://nightnovelapp.tech/home?lang=ar",
    logo: NIGHT_NOVEL_LOGO_URL,
    initials: "NN",
    contentLabel: "روايات خفيفة",
    contentTypes: ["novel"],
    languages: ["ar"],
  },
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
  cenele: {
    id: "cenele",
    name: "Cenele",
    arabicName: "فضاء الروايات",
    domain: "cenele.com",
    url: "https://cenele.com/",
    logo: CENELE_LOGO_URL,
    initials: "CE",
    contentLabel: "روايات ومانهوا",
    contentTypes: ["novel", "manga"],
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
  arabshentai: {
    id: "arabshentai",
    name: "Arabs Hentai",
    arabicName: "عربس هنتاي",
    domain: "arabshentai.com",
    url: "https://arabshentai.com/manga/",
    logo: ARABS_HENTAI_LOGO_URL,
    initials: "AH",
    contentLabel: "مانغا ومانهوا",
    contentTypes: ["manga"],
    languages: ["ar"],
  },
  hentairead: {
    id: "hentairead",
    name: "HentaiRead",
    arabicName: "هنتاي ريد",
    domain: "hentairead.com",
    url: "https://hentairead.com/hentai/",
    logo: HENTAIREAD_LOGO_URL,
    initials: "HR",
    contentLabel: "مانغا إنجليزية",
    contentTypes: ["manga"],
    languages: ["en"],
  },
  hentaigasm: {
    id: "hentaigasm",
    name: "HentaiGasm",
    arabicName: "هنتاي غازم",
    domain: "hentaigasm.com",
    url: "https://hentaigasm.com/",
    logo: HENTAIGASM_LOGO_URL,
    initials: "HG",
    contentLabel: "أنمي هنتاي",
    contentTypes: ["anime"],
    languages: ["en"],
  },
};

export const initialSources = Object.values(sourceProfiles).map((profile) => ({
  id: profile.id,
  name: profile.name,
  url: profile.url,
  status: "متصل",
  initials: profile.initials,
  logoUrl: profile.logo,
}));

export const initialSourcePreferences = Object.fromEntries(
  Object.keys(sourceProfiles).map((sourceId) => [sourceId, { mode: "full", selectedItems: [] }]),
);

export function getSourceProfile(sourceId) {
  return sourceProfiles[sourceId] || sourceProfiles.mangalik;
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
  const moviesPath = sourceId === "wiflix" ? "/film-en-streaming/" : "/films/";
  const seriesPath = sourceId === "wiflix" ? "/serie-en-streaming/" : "/s-tv/";
  return [
    { slug: "all", name: "الكل", filterPath: "/all/" },
    { slug: "movies", name: "أفلام", filterPath: moviesPath },
    { slug: "series", name: "مسلسلات", filterPath: seriesPath },
  ];
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

  if (sourceId === "arabshentai") {
    return [
      { slug: "all", name: "الكل", type: "kind" },
      { slug: "manhwa", name: "مانهوا", type: "kind", queryValue: "manhwa" },
      { slug: "manga", name: "مانجا", type: "kind", queryValue: "manga" },
      { slug: "anime", name: "أنمي", type: "kind", queryValue: "anime" },
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
  if (item?.sourceId) return item.sourceId;
  if (item?.source === "AzoraFly") return "azorafly";
  if (item?.source === "Galaxy Novels") return "galaxynovels";
  if (item?.source === "Novels Paradise") return "novelsparadise";
  if (item?.sourceId === "novelsparadise") return "novelsparadise";
  if (item?.source === "Night Novel") return "nightnovel";
  if (item?.sourceId === "nightnovel") return "nightnovel";
  if (item?.source === "Realm Novel") return "realmnovel";
  if (item?.sourceId === "realmnovel") return "realmnovel";
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
  if (item?.source === "MangaForFree") return "mangaforfree";
  if (item?.sourceId === "mangaforfree") return "mangaforfree";
  if (item?.source === "Dilar") return "dilar";
  if (item?.sourceId === "dilar") return "dilar";
  if (item?.source === "Arabs Hentai") return "arabshentai";
  if (item?.sourceId === "arabshentai") return "arabshentai";
  if (item?.source === "HentaiRead") return "hentairead";
  if (item?.sourceId === "hentairead") return "hentairead";
  if (item?.source === "HentaiGasm") return "hentaigasm";
  if (item?.sourceId === "hentaigasm") return "hentaigasm";
  return "mangalik";
}
