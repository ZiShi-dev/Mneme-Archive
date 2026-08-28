import { handleSourceRequest } from "../server/mangaSourcesPlugin.js";

const url = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny";
const details = await handleSourceRequest(`/api/sources/azorafly/manga?url=${encodeURIComponent(url)}`);
const unlocked = details.body.chapters.find((c) => !c.locked);
const locked = details.body.chapters.find((c) => c.locked);
for (const [label, ch] of [["unlocked", unlocked], ["locked", locked]]) {
  const html = await fetch(ch.url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
  const patterns = [
    /https:\/\/storage\.azorafly\.com\/upload\/series\/[^"'\\s]+/gi,
    /"src":"(https:\\\/\\\/storage\.azorafly\.com[^"]+)"/gi,
    /images":\[([\s\S]*?)\]/i,
    /chapterImages/gi,
  ];
  console.log("\n", label, ch.number);
  for (const p of patterns) {
    const m = html.match(p);
    console.log(p.source.slice(0, 40), m ? (Array.isArray(m) ? m.length : m[0]?.slice(0, 80)) : 0);
  }
}
