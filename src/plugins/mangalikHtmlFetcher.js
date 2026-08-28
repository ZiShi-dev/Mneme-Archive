import { registerPlugin } from "@capacitor/core";

export const MangalikHtmlFetcher = registerPlugin("MangalikHtmlFetcher", {
  web: () => import("./mangalikHtmlFetcher.web.js").then((module) => new module.MangalikHtmlFetcherWeb()),
});
