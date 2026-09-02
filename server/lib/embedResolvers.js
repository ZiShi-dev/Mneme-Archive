import { fetchWithRetries } from "./httpUtils.js";
import { isAdSegmentUrl } from "./hlsProxy.js";
import { assertPublicHttpsUrl, isBlockedNetworkHost } from "./urlSecurity.js";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PACKED_PLAYER_PATTERN = /\)\("([A-Za-z0-9+/=]{40,})"\)/g;
const FAKE_STREAM_PATTERN = /(?:troll\/master|\/ads?\/|preroll|fake\.m3u8|decoy)/i;
const VIDZY_HOST_PATTERN = /(?:^|\.)(?:vidzy\.(?:cc|live|org)|fsvid\.lol)$/i;
const EMBED_HOST_PATTERN = /(^|\.)(4h\.b9p2m6c\.shop|[a-z0-9-]+\.b9p2m6c\.shop|[0-9][a-z0-9]\.[a-z0-9]+\.shop|[a-z0-9-]+\.anime4up\.rest|(?:[a-z0-9-]+\.)?embed4me\.com|voe\.sx|vidzy\.(?:cc|live|org)|(?:[a-z0-9-]+\.)?filemoon\.(?:to|sx|com)|(?:[a-z0-9-]+\.)?mp4upload\.com|(?:[a-z0-9-]+\.)?share4max\.(?:com|org)|vkvideo\.ru|(?:[a-z0-9-]+\.)?playmogo\.com|(?:[a-z0-9-]+\.)?rubyvidhub\.com|(?:[a-z0-9-]+\.)?uqload\.(?:com|net|to|cx|vc)|(?:[a-z0-9-]+\.)?dood\.(?:com|watch)|(?:[a-z0-9-]+\.)?streamruby\.com|videa\.hu|96ar\.com|(?:[a-z0-9-]+\.)?fsvid\.lol|(?:[a-z0-9-]+\.)?kakaflix\.[a-z]{2,}|(?:[a-z0-9-]+\.)?flixeo\.xyz|(?:[a-z0-9-]+\.)?multiup\.us|(?:[a-z0-9-]+\.)?netu\.[a-z]{2,}|(?:[a-z0-9-]+\.)?filmoon\.[a-z]{2,}|sandratableother\.com|diananatureforeign\.com|drive\.google\.com|(?:www\.)?dailymotion\.com|(?:www\.)?ok\.ru|bysezoxexe\.com)$/i;

export function decodePackedPlayerSource(packed = "", hostname = "vidzy.cc") {
  const host = String(hostname || "");
  let seed = 0;
  for (let index = 0; index < host.length; index += 1) {
    seed = (seed + host.charCodeAt(index)) & 255;
  }
  const reversed = atob(packed).split("").reverse().join("");
  let decoded = "";
  for (let index = 0; index < reversed.length; index += 1) {
    decoded += String.fromCharCode(reversed.charCodeAt(index) ^ ((0x3d + index * 89 + seed) & 255));
  }
  return decoded;
}

function isValidStreamUrl(url = "") {
  return /^https?:\/\//i.test(url)
    && !FAKE_STREAM_PATTERN.test(url)
    && !isAdSegmentUrl(url)
    && (/\.m3u8/i.test(url) || /\.mp4(?:\?|$)/i.test(url));
}

function decodePackerEval(source = "") {
  const marker = "eval(function(p,a,c,k,e,d)";
  const start = String(source).indexOf(marker);
  if (start < 0) return "";
  const splitMarker = ".split('|'))";
  const splitIdx = String(source).indexOf(splitMarker, start);
  if (splitIdx < 0) return "";

  const block = String(source).slice(start, splitIdx + splitMarker.length);
  const open = block.indexOf("('") + 2;
  let cursor = open;
  for (; cursor < block.length; cursor += 1) {
    const char = block[cursor];
    if (char === "\\") {
      cursor += 1;
      continue;
    }
    if (char === "'") {
      const rest = block.slice(cursor + 1);
      if (/^,\d+,\d+,'/.test(rest)) break;
    }
  }

  const packed = block.slice(open, cursor).replace(/\\'/g, "'");
  const meta = block.slice(cursor + 1).match(/^,(\d+),(\d+),'/);
  if (!meta) return "";

  const base = Number(meta[1]);
  const count = Number(meta[2]);
  const dictStart = cursor + 1 + meta[0].length;
  const dictEnd = block.lastIndexOf("'.split('|'))");
  const dict = block.slice(dictStart, dictEnd).split("|");
  let decoded = packed;
  let dictCursor = count;
  while (dictCursor--) {
    const replacement = dict[dictCursor];
    if (!replacement) continue;
    decoded = decoded.replace(new RegExp(`\\b${dictCursor.toString(base)}\\b`, "g"), replacement);
  }
  return decoded;
}

function extractQuotedStreamUrl(text = "") {
  const candidates = [
    ...String(text).matchAll(/file:\s*"(https?:[^"]+)"/gi),
    ...String(text).matchAll(/sources:\s*\[\s*\{[^}]*file:\s*"(https?:[^"]+)"/gi),
    ...String(text).matchAll(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/gi),
    ...String(text).matchAll(/"(https?:\/\/[^"]+\.mp4[^"]*)"/gi),
  ].map((match) => match[1]);
  return candidates.find((entry) => isValidStreamUrl(entry)) || "";
}

function extractUqloadStream(html = "", embedUrl = "") {
  const decoded = decodePackerEval(html);
  const url = extractQuotedStreamUrl(decoded) || extractQuotedStreamUrl(html);
  if (!url) return null;
  return {
    url,
    type: /\.m3u8/i.test(url) ? "hls" : "mp4",
    referer: embedUrl,
  };
}

function extractStreamFromEmbedHtml(html = "", hostname = "vidzy.cc") {
  const packedMatches = [...String(html).matchAll(PACKED_PLAYER_PATTERN)];
  for (const match of packedMatches) {
    try {
      const decoded = decodePackedPlayerSource(match[1], hostname);
      if (isValidStreamUrl(decoded)) {
        return { url: decoded, type: /\.m3u8/i.test(decoded) ? "hls" : "mp4" };
      }
    } catch {
      // Some decoy payloads are not valid base64 for this player.
    }
  }
  const plainM3u8 = String(html).match(/https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/i)?.[0] || "";
  if (isValidStreamUrl(plainM3u8)) return { url: plainM3u8, type: "hls" };
  const plainMp4 = String(html).match(/https?:\/\/[^"'\\\s]+\.mp4[^"'\\\s]*/i)?.[0] || "";
  if (isValidStreamUrl(plainMp4)) return { url: plainMp4, type: "mp4" };
  const sourcesMatch = String(html).match(/sources:\s*\[\s*"(https?:[^"]+)"/i);
  if (sourcesMatch && isValidStreamUrl(sourcesMatch[1])) {
    return { url: sourcesMatch[1], type: /\.m3u8/i.test(sourcesMatch[1]) ? "hls" : "mp4" };
  }
  const fileMatch = String(html).match(/file:\s*"(https?:[^"]+)"/i);
  if (fileMatch && isValidStreamUrl(fileMatch[1])) {
    return { url: fileMatch[1], type: /\.m3u8/i.test(fileMatch[1]) ? "hls" : "mp4" };
  }
  return null;
}

export function extractPackedPlayerStreamUrl(html = "", hostname = "vidzy.cc") {
  return extractStreamFromEmbedHtml(html, hostname)?.url || "";
}

export function isAllowedEmbedHost(hostname = "") {
  return EMBED_HOST_PATTERN.test(String(hostname).toLowerCase());
}

export function assertProxiedEmbedUrl(rawUrl = "") {
  const url = assertPublicHttpsUrl(rawUrl, { label: "رابط التضمين" });
  const parsed = new URL(url);
  if (!isAllowedEmbedHost(parsed.hostname)) {
    throw new Error("مصدر التضمين غير مسموح");
  }
  return url;
}

export function wrapProxiedEmbedHtml(html = "", embedUrl = "") {
  const body = String(html || "").trim();
  if (!body || !/<html/i.test(body)) return body;
  try {
    const base = new URL(embedUrl).origin + "/";
    if (/<base\s/i.test(body)) return body;
    return body.replace(/<head([^>]*)>/i, `<head$1><base href="${base}">`);
  } catch {
    return body;
  }
}

async function probeDirectStream(stream = {}) {
  if (!stream?.url) return false;
  try {
    const response = await fetchWithRetries(stream.url, {
      headers: {
        accept: "*/*",
        referer: stream.referer || stream.url,
        "user-agent": BROWSER_UA,
      },
      timeoutMs: 12_000,
    }, 0);
    if (!response.ok) return false;
    const text = await response.text();
    return /\.m3u8/i.test(stream.url) || /mpegurl|m3u8/i.test(response.headers.get("content-type") || "")
      || text.trimStart().startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

export async function fetchEmbedHtml(embedUrl, referer = "") {
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    referer: referer || embedUrl,
    "user-agent": BROWSER_UA,
  };
  let url = embedUrl;
  let cookie = "";
  let html = "";
  let challengeHtml = "";

  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetchWithRetries(url, {
      headers: {
        ...headers,
        ...(cookie ? { cookie } : {}),
      },
      timeoutMs: 20_000,
    }, 1);
    if (typeof response.headers.getSetCookie === "function") {
      cookie = mergeCookieHeader(cookie, response.headers.getSetCookie());
    }
    html = await response.text();
    if (!response.ok) throw new Error(`Embed indisponible (${response.status})`);

    const challengeUrl = extractJsChallengeUrl(html, url);
    if (!challengeUrl || challengeUrl === url) break;
    challengeHtml = html;
    headers.referer = url;
    url = challengeUrl;
  }

  return html.trim() ? html : challengeHtml;
}

export function extractJsChallengeUrl(html = "", baseUrl = "") {
  const match = String(html).match(/window\.location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (!match) return "";
  try {
    return new URL(match[1], baseUrl).toString();
  } catch {
    return "";
  }
}

function mergeCookieHeader(existing = "", setCookies = []) {
  const jar = new Map();
  for (const part of String(existing || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const cookie of setCookies) {
    const pair = String(cookie || "").split(";")[0]?.trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function isLockedUqloadEmbed(html = "") {
  return /File was locked by administrator/i.test(String(html || ""));
}

function extractNestedIframeSrc(html = "", baseUrl = "") {
  const match = String(html).match(/<iframe[^>]+src=(['"])([^'"]+)\1/i);
  if (!match) return "";
  try {
    return new URL(match[2], baseUrl).toString();
  } catch {
    return "";
  }
}

export async function resolveEmbedDirectStream(embedUrl = "", referer = "") {
  let parsed;
  try {
    parsed = new URL(embedUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const html = await fetchEmbedHtml(parsed.toString(), referer);
  if (/uqload\./i.test(parsed.hostname) && isLockedUqloadEmbed(html)) {
    return { locked: true };
  }
  if (/uqload\./i.test(parsed.hostname)) {
    const uqload = extractUqloadStream(html, parsed.toString());
    if (uqload) return uqload;
  }
  if (VIDZY_HOST_PATTERN.test(parsed.hostname) || /fsvid\.lol/i.test(parsed.hostname)) {
    const stream = extractStreamFromEmbedHtml(html, parsed.hostname);
    if (stream) return { ...stream, referer: parsed.toString() };
  }

  const generic = extractStreamFromEmbedHtml(html, parsed.hostname);
  if (generic) return { ...generic, referer: parsed.toString() };

  const nestedIframe = extractNestedIframeSrc(html, parsed.toString());
  if (nestedIframe && nestedIframe !== parsed.toString()) {
    try {
      const nested = new URL(nestedIframe);
      if (nested.protocol === "https:" && nested.hostname !== parsed.hostname) {
        return resolveEmbedDirectStream(nestedIframe, parsed.toString());
      }
    } catch {
      // Ignore nested iframe invalide.
    }
  }

  return null;
}

export async function enrichSourcesWithStreams(sources = [], referer = "") {
  const enriched = await Promise.all((sources || []).map(async (source) => {
    if (!source?.url || source.streamUrl) return source;
    try {
      const stream = await resolveEmbedDirectStream(source.url, referer || source.url);
      if (stream?.locked) return { ...source, locked: true };
      if (!stream) return source;
      const playable = await probeDirectStream(stream);
      if (!playable) {
        return {
          ...source,
          embedFallback: true,
        };
      }
      return {
        ...source,
        streamUrl: stream.url,
        streamReferer: stream.referer,
        streamType: stream.type,
      };
    } catch {
      return source;
    }
  }));

  return enriched
    .filter((entry) => !entry.locked)
    .sort((left, right) => {
    const leftUrl = `${left.streamUrl || ""} ${left.url || ""}`;
    const rightUrl = `${right.streamUrl || ""} ${right.url || ""}`;
    const hostRank = (url) => {
      const order = [/vidzy\./i, /fsvid\./i, /filemoon\./i, /uqload\./i, /voe\.sx/i, /dood\./i];
      const index = order.findIndex((pattern) => pattern.test(url));
      return index === -1 ? 0 : (order.length - index) * 5;
    };
    const leftScore = Number(Boolean(left.streamUrl)) * 100
      + (left.streamType === "hls" ? 24 : 0)
      + hostRank(leftUrl);
    const rightScore = Number(Boolean(right.streamUrl)) * 100
      + (right.streamType === "hls" ? 24 : 0)
      + hostRank(rightUrl);
    return rightScore - leftScore;
  });
}

export function isAllowedProxiedStreamHost(hostname = "") {
  const host = String(hostname).toLowerCase();
  if (!host || isBlockedNetworkHost(host)) return false;
  return VIDZY_HOST_PATTERN.test(host)
    || /fsvid\.lol$/i.test(host)
    || /^u\d+\.vidzy\./i.test(host)
    || /(?:^|\.)(?:strm\d+\.)?uqload\.vc$/i.test(host)
    || /(?:^|\.)uqload\.(?:com|net|to|cx|vc)$/i.test(host)
    || /filemoon\./i.test(host);
}

export function assertProxiedStreamUrl(rawUrl = "") {
  const url = assertPublicHttpsUrl(rawUrl, { label: "رابط البث" });
  const parsed = new URL(url);
  if (!isAllowedProxiedStreamHost(parsed.hostname)) {
    throw new Error("مصدر البث غير مسموح");
  }
  return url;
}
