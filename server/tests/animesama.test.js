import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAnimesamaCatalogUrl,
  catalogHasMore,
  normalizeAnimesamaUrl,
  parseAnimesamaCatalog,
  parseAnimesamaEpisodesJs,
  parseAnimesamaSearchResults,
  enrichAnimesamaCatalogItems,
} from "../sources/animesama.js";

describe("animesama", () => {
  it("buildAnimesamaCatalogUrl gère filterPath et pagination", () => {
    assert.equal(
      buildAnimesamaCatalogUrl(1, "/all/"),
      "https://anime-sama.to/catalogue/",
    );
    assert.equal(
      buildAnimesamaCatalogUrl(2, "/all/"),
      "https://anime-sama.to/catalogue/?page=2",
    );
    assert.equal(
      buildAnimesamaCatalogUrl(1, "/catalogue/action/"),
      "https://anime-sama.to/catalogue/action/",
    );
  });

  it("catalogHasMore ne devine pas une page suivante sans lien", () => {
    assert.equal(catalogHasMore('<a href="/catalogue/?page=2">2</a>', 1), true);
    assert.equal(catalogHasMore('<div class="catalog-card"></div>', 1), false);
    assert.equal(catalogHasMore('<a href="/catalogue/?page=2">2</a>', 2), false);
  });

  it("normalise les URLs du domaine principal", () => {
    assert.equal(
      normalizeAnimesamaUrl("https://anime-sama.fr/catalogue/naruto/"),
      "https://anime-sama.to/catalogue/naruto/",
    );
  });

  it("parse les cartes catalogue", () => {
    const html = `
      <div class="shrink-0 catalog-card card-base">
        <a href="https://anime-sama.to/catalogue/naruto/">
          <img class="card-image" src="https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/naruto.webp" alt="Naruto">
          <h2 class="card-title">Naruto</h2>
          <p class="alternate-titles">Naruto Origin</p>
        </a>
      </div>
    `;
    const items = parseAnimesamaCatalog(html);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Naruto");
    assert.equal(items[0].sourceId, "animesama");
    assert.equal(items[0].url, "https://anime-sama.to/catalogue/naruto/");
  });

  it("parse les résultats de recherche", () => {
    const html = `
      <a href="https://anime-sama.to/catalogue/naruto/" class="asn-search-result">
        <img src="https://cdn.jsdelivr.net/gh/Anime-Sama/IMG@img/contenu/thumb/naruto.webp" alt="">
        <h3 class="asn-search-result-title">Naruto</h3>
        <p class="asn-search-result-subtitle">Naruto Origin</p>
      </a>
    `;
    const items = parseAnimesamaSearchResults(html);
    assert.equal(items.length, 1);
    assert.equal(items[0].altTitle, "Naruto Origin");
  });

  it("parse episodes.js", () => {
    const script = `
      var eps1 = ['https://lpayer.embed4me.com/#sat5e','https://lpayer.embed4me.com/#z9j18'];
      var eps2 = ['https://lpayer.embed4me.com/#aaaaa','https://lpayer.embed4me.com/#bbbbb'];
    `;
    const players = parseAnimesamaEpisodesJs(script);
    assert.equal(players.length, 2);
    assert.equal(players[0].urls.length, 2);
    assert.match(players[0].urls[0], /embed4me\.com/);
  });

  it("enrichCatalogItems ajoute les derniers épisodes", async () => {
    const items = [{
      url: "https://anime-sama.to/catalogue/tis-time-for-torture-princess/",
      title: "Tis Time for Torture, Princess",
      recentChapters: [],
    }];
    await enrichAnimesamaCatalogItems(items, { concurrency: 1 });
    assert.ok(items[0].chapterCount > 0, "chapterCount devrait être renseigné");
    assert.equal(items[0].recentChapters.length, 2);
    assert.match(items[0].recentChapters[0].url, /\?ep=\d+$/);
  });
});
