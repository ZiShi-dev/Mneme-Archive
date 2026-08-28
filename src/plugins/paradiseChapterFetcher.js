import { registerPlugin } from "@capacitor/core";

export const ParadiseChapterFetcher = registerPlugin("ParadiseChapterFetcher", {
  web: () => import("./paradiseChapterFetcher.web.js").then((module) => new module.ParadiseChapterFetcherWeb()),
});
