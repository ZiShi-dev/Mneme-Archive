import { handleSourceRequest } from "../server/mangaSourcesPlugin.js";

const seriesUrl = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny";
const details = await handleSourceRequest(`/api/sources/azorafly/manga?url=${encodeURIComponent(seriesUrl)}`);

for (const num of ["1", "14", "27"]) {
  const ch = details.body.chapters.find((c) => c.number === num);
  const parsed = await handleSourceRequest(`/api/sources/azorafly/chapter?url=${encodeURIComponent(ch.url)}`);
  const first = parsed.body.pages?.[0]?.src;
  let imgOk = false;
  if (first) {
    const img = await handleSourceRequest(`/api/sources/azorafly/image?url=${encodeURIComponent(first)}`);
    imgOk = img.kind === "image" && img.buffer?.length > 500;
  }
  console.log(`ch ${num}: locked=${ch.locked} pages=${parsed.body.pages?.length || 0} img=${imgOk} sample=${first?.slice(-35)}`);
}
