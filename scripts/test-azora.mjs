const url = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny";
const html = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
const slug = "once-an-assassin-now-a-royal-nanny";
const postId1 = html.match(
  new RegExp(`&quot;post&quot;:\\[0,\\{&quot;id&quot;:\\[0,(\\d+)\\],&quot;slug&quot;:\\[0,&quot;${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}&quot;`, "i"),
)?.[1];
console.log("postId regex", postId1);
const links = [...html.matchAll(new RegExp(`/series/${slug}/(chapter-[^"#?]+)`, "gi"))];
console.log("chapter links in html", new Set(links.map((m) => m[1])).size);
