import { handleSourceRequest } from "../server/mangaSourcesPlugin.js";

const AZORA_API_URL = "https://api.azorafly.com";
const cat = await handleSourceRequest("/api/sources/azorafly/catalog?page=1");
for (const item of cat.body.items.slice(0, 15)) {
  const html = await fetch(item.url).then((r) => r.text());
  const slug = new URL(item.url).pathname.split("/").filter(Boolean).pop();
  const postId = Number(html.match(new RegExp(`&quot;post&quot;:\\[0,\\{&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}&quot;`, "i"))?.[1] ?? 0);
  if (!postId) continue;
  const data = await fetch(`${AZORA_API_URL}/api/chapters?postId=${postId}&skip=0&take=all&order=desc`, {
    headers: { referer: "https://azorafly.com/", accept: "application/json" },
  }).then((r) => r.json());
  const short = data.post?.chapters?.filter((c) => c.isShortLinkLocked);
  if (short?.length) console.log(item.title, short.length, short[0]);
}
