import { registerPlugin } from "@capacitor/core";

export const AnimeEpisodePlayer = registerPlugin("AnimeEpisodePlayer", {
  web: () => import("./animeEpisodePlayer.web.js").then((module) => new module.AnimeEpisodePlayerWeb()),
});
