import { handleSourceRequest } from "../server/mangaSourcesPlugin.js";

const seriesUrl = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny";
const details = await handleSourceRequest(`/api/sources/azorafly/manga?url=${encodeURIComponent(seriesUrl)}`);
for (const num of ["14", "13", "27"]) {
  const ch = details.body.chapters.find((c) => c.number === num);
  const html = await fetch(ch.url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
  const oldPattern = html.match(/storage\.azorafly\.com\/upload\/series/gi);
  const publicPattern = html.match(/storage\.azorafly\.com\/public\/upload\/series/gi);
  const anyUpload = [...html.matchAll(/https:\/\/storage\.azorafly\.com\/[^"'\\s)]+/gi)].slice(0, 5);
  const parsed = await handleSourceRequest(`/api/sources/azorafly/chapter?url=${encodeURIComponent(ch.url)}`);
  console.log("\nChapter", num, "locked?", ch.locked, "parsed pages", parsed.body.pages?.length);
  console.log("old pattern count", oldPattern?.length || 0, "public pattern", publicPattern?.length || 0);
  console.log("sample urls", anyUpload);
}
