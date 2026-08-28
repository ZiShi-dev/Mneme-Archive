import { readFileSync } from "fs";
import { createCachedHtmlFetcher } from "../server/lib/httpUtils.js";

const AZORA_URL = "https://azorafly.com";
const fetchAzoraHtml = createCachedHtmlFetcher({
  ttlMs: 0,
  timeoutMs: 30000,
  headers: { "user-agent": "Mozilla/5.0" },
  getVariants: (url) => [url],
  buildError: (s) => String(s),
});

function extractPostId(html, slug) {
  const patterns = [
    new RegExp(`&quot;post&quot;:\\[0,\\{&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}&quot;`, "i"),
    new RegExp(`"post":\\[0,\\{"id":\\[0,(\\d+)\\],"slug":\\[0,"${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i"),
    /&quot;id&quot;:\[0,(\d+)\],&quot;slug&quot;:\[0,&quot;([^&]+)&quot;/gi,
  ];
  for (const pattern of patterns.slice(0, 2)) {
    const match = html.match(pattern)?.[1];
    if (match) return Number(match);
  }
  for (const match of html.matchAll(patterns[2])) {
    if (match[2] === slug) return Number(match[1]);
  }
  return 0;
}

const { handleSourceRequest } = await import("../server/mangaSourcesPlugin.js");
for (let page = 1; page <= 5; page++) {
  const cat = await handleSourceRequest(`/api/sources/azorafly/catalog?page=${page}`);
  for (const item of cat.body.items) {
    const slug = new URL(item.url).pathname.split("/").filter(Boolean).pop();
    const html = await fetchAzoraHtml(item.url);
    const postId = extractPostId(html, slug);
    const details = await handleSourceRequest(`/api/sources/azorafly/manga?url=${encodeURIComponent(item.url)}`);
    if (!postId || !details.body.chapters?.length) {
      console.log("FAIL", item.title, "postId", postId, "chapters", details.body.chapters?.length);
    }
  }
}
console.log("done");
