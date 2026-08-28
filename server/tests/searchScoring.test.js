import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchVariants,
  pickTypoFallbackQueries,
  pickVariantQueries,
  rankSearchResults,
  scoreSearchItem,
} from "../lib/searchScoring.js";

test("buildSearchVariants includes typo variants for short tokens", () => {
  const variants = buildSearchVariants("jon weik");
  assert.ok(variants.includes("jon weik"));
  assert.ok(pickTypoFallbackQueries("jon weik").includes("joh"));
});

test("pickTypoFallbackQueries skips bare tokens from the original query", () => {
  const variants = pickTypoFallbackQueries("jon weik");
  assert.ok(!variants.includes("jon"));
  assert.ok(!variants.includes("weik"));
});

test("scoreSearchItem tolerates jon weik against John Wick", () => {
  const score = scoreSearchItem({ title: "John Wick 4" }, "jon weik");
  assert.ok(score >= 0.55);
});

test("scoreSearchItem rejects weak partial matches", () => {
  const johnathan = scoreSearchItem({ title: "Contact in the Woods: The Dr. Johnathan Reed Story" }, "jon weik");
  const williams = scoreSearchItem({ title: "Music by John Williams" }, "jon weik");
  const wick = scoreSearchItem({ title: "John Wick 4" }, "jon weik");
  assert.ok(wick > johnathan);
  assert.ok(wick > williams);
  assert.ok(johnathan < 0.55);
});

test("rankSearchResults keeps relevant items and drops unrelated noise", () => {
  const items = [
    { title: "John Wick 4", url: "https://example.com/1" },
    { title: "Wicked : Partie II", url: "https://example.com/2" },
    { title: "Music by John Williams", url: "https://example.com/3" },
    { title: "Contact in the Woods: The Dr. Johnathan Reed Story", url: "https://example.com/4" },
  ];
  const ranked = rankSearchResults(items, "jon weik");
  assert.equal(ranked[0]?.title, "John Wick 4");
  assert.ok(ranked.length <= 2);
});

test("rankSearchResults prefers You seasons over substring titles", () => {
  const ranked = rankSearchResults([
    { title: "Youngblood", url: "https://example.com/youngblood" },
    { title: "A Time Called You - Saison 1", url: "https://example.com/time" },
    { title: "You - Saison 4", url: "https://example.com/you4" },
    { title: "You - Saison 5", url: "https://example.com/you5" },
  ], "you");
  assert.equal(ranked[0]?.title, "You - Saison 5");
  assert.equal(ranked[1]?.title, "You - Saison 4");
  assert.ok(!ranked.some((item) => item.title === "Youngblood"));
});
