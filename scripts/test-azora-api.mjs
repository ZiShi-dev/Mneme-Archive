const url = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny/chapter-14";
const html = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
const chapterId = html.match(/&quot;id&quot;:\[0,(\d+)\],&quot;slug&quot;:\[0,&quot;chapter-14&quot;/i)?.[1];
console.log("chapterId", chapterId);

for (const ep of [
  `/api/chapters/${chapterId}`,
  `/api/chapter/${chapterId}`,
  `/api/chapters/${chapterId}/pages`,
  `/api/chapter-pages?chapterId=${chapterId}`,
]) {
  const response = await fetch(`https://api.azorafly.com${ep}`, {
    headers: { accept: "application/json", referer: "https://azorafly.com/" },
  });
  const text = await response.text();
  console.log("\n", ep, response.status, text.slice(0, 400));
}
