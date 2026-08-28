import { handleSourceRequest } from "../server/mangaSourcesPlugin.js";

const chapterUrl = "https://azorafly.com/series/once-an-assassin-now-a-royal-nanny/chapter-14";
const parsed = await handleSourceRequest(`/api/sources/azorafly/chapter?url=${encodeURIComponent(chapterUrl)}`);
console.log("pages from handler:", parsed.body.pages?.length);

const html = await fetch(chapterUrl, {
  headers: {
    accept: "text/html,application/xhtml+xml",
    "accept-language": "ar,en;q=0.9",
    "user-agent": "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  },
}).then((r) => r.text());

const plain = [...html.matchAll(/https:\/\/storage\.azorafly\.com\/(?:public\/)?upload\/series\/once-an-assassin[^"'\\s<>]+/gi)];
const escaped = [...html.matchAll(/https:\\\/\\\/storage\.azorafly\.com\\\/public\\\/upload\\\/series\\\/once-an-assassin[^"'\\s<>]+/gi)];
console.log("plain urls in html:", plain.length);
console.log("escaped urls in html:", escaped.length);

// test broader pattern without series slug requirement
const broad = [...html.matchAll(/https:\/\/storage\.azorafly\.com\/(?:public\/)?upload\/series\/[^"'\\s<>]+\/page-[^"'\\s<>]+/gi)];
console.log("broad pattern:", broad.length);
