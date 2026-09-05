import { isCloudflareChallengeHtml } from "./cloudflareDetect.js";
import { validatePublicDestination, publicFetch } from "./publicFetch.js";

const DEFAULT_TIMEOUT_MS = 45_000;
/** FlareSolverr / Chrome tient mal le parallèle → file globale (1 par défaut). */
const FLARE_MAX_CONCURRENT = Math.max(1, Number(globalThis?.process?.env?.FLARE_MAX_CONCURRENT) || 1);
const FLARE_CRASH_COOLDOWN_MS = 2_500;

let flareActive = 0;
const flareWaiters = [];
let flareCooldownUntil = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function releaseFlareSlot() {
  flareActive = Math.max(0, flareActive - 1);
  const next = flareWaiters.shift();
  if (next) next();
}

async function withFlareSlot(task) {
  if (flareActive >= FLARE_MAX_CONCURRENT) {
    await new Promise((resolve) => {
      flareWaiters.push(resolve);
    });
  }
  flareActive += 1;
  try {
    const cooldown = Math.max(0, flareCooldownUntil - Date.now());
    if (cooldown) await wait(cooldown);
    return await task();
  } finally {
    releaseFlareSlot();
  }
}

function isFlareChromeCrash(message = "") {
  return /tab crashed|chrome not reachable|Max retries exceeded with url: \/session|Failed to establish a new connection|session deleted|Unable to find session/i
    .test(String(message || ""));
}

function isCloudflareIpBlockedMessage(message = "") {
  return /cloudflare has blocked this request|probably your ip is banned|ip is banned|cloudflare a bloqué l'ip|bloqué l'ip du serveur/i
    .test(String(message || ""));
}

const FLARE_IP_BLOCK_COOLDOWN_MS = process.env.NODE_ENV === "test" ? 0 : 5 * 60 * 1000;
const hostBlockCooldownUntil = new Map();

function hostKeyFromUrl(rawUrl = "") {
  try {
    return new URL(String(rawUrl)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function markFlareHostBlockCooldown(url = "", error) {
  const message = String(error?.message || error || "");
  if (!isCloudflareIpBlockedMessage(message)) return;
  const host = hostKeyFromUrl(url);
  if (host) hostBlockCooldownUntil.set(host, Date.now() + FLARE_IP_BLOCK_COOLDOWN_MS);
  flareCooldownUntil = Date.now() + FLARE_IP_BLOCK_COOLDOWN_MS;
}

function isFlareHostBlockCooldown(url = "") {
  const host = hostKeyFromUrl(url);
  const hostUntil = host ? (hostBlockCooldownUntil.get(host) || 0) : 0;
  return Date.now() < Math.max(hostUntil, flareCooldownUntil);
}

function markFlareCrashCooldown(error) {
  if (isFlareChromeCrash(error?.message)) {
    flareCooldownUntil = Date.now() + FLARE_CRASH_COOLDOWN_MS;
  }
}

export function isFlareProxyUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  try {
    const path = new URL(trimmed).pathname.replace(/\/+$/, "");
    return path === "/api/public/flare" || path.endsWith("/api/public/flare");
  } catch {
    return false;
  }
}

function buildFlareSolverrEndpoint(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (isFlareProxyUrl(trimmed)) return `${trimmed}/solve`;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function toBase64(value) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  return btoa(value);
}

async function readFlareResponseBody(response) {
  if (typeof response.text === "function") return response.text();
  if (typeof response.json === "function") return JSON.stringify(await response.json());
  return "";
}

function parseFlarePayload(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return {};
  }
}

function errorFromFlareResponse(response, payload, rawText) {
  if (payload?.success === false && payload.error) {
    if (isCloudflareIpBlockedMessage(payload.error)) {
      return new Error("Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.");
    }
    if (isFlareChromeCrash(payload.error)) {
      return new Error("FlareSolverr surchargé (Chrome a planté). Réessaie dans quelques secondes.");
    }
    return new Error(payload.error);
  }
  const upstreamMessage = payload?.message || payload?.error || "";
  if (isCloudflareIpBlockedMessage(upstreamMessage) || isCloudflareIpBlockedMessage(rawText)) {
    return new Error("Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.");
  }
  if (isFlareChromeCrash(upstreamMessage) || isFlareChromeCrash(rawText)) {
    return new Error("FlareSolverr surchargé (Chrome a planté). Réessaie dans quelques secondes.");
  }
  if (response.status === 429) {
    return new Error("Trop de requêtes FlareSolverr, réessaie dans quelques minutes");
  }
  if (
    response.status === 502
    || response.status === 504
    || /bad gateway|error code 502/i.test(rawText || "")
  ) {
    return new Error("حماية Cloudflare : le proxy Night-Novel n'a pas répondu à temps");
  }
  return new Error(payload.error || payload.message || "FlareSolverr a échoué");
}

function shouldRetryFlareError(error) {
  const message = String(error?.message || "");
  // Crash Chrome / IP bannie / surcharge : un retry immédiat aggrave la panne.
  if (
    isFlareChromeCrash(message)
    || isCloudflareIpBlockedMessage(message)
    || /surchargé|Trop de requêtes|URL (invalide|non autorisée)|Hôte non autorisé|n'a pas répondu à temps|bad gateway/i.test(message)
  ) {
    return false;
  }
  return /Challenge non résolu|FlareSolverr a échoué|encore bloquée|indisponible|autre site/i.test(message);
}

function extractHtml(payload, proxyMode) {
  if (proxyMode) {
    if (payload?.success === false) {
      const err = payload.error || "FlareSolverr a échoué";
      if (isCloudflareIpBlockedMessage(err)) {
        throw new Error("Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.");
      }
      if (isFlareChromeCrash(err)) {
        throw new Error("FlareSolverr surchargé (Chrome a planté). Réessaie dans quelques secondes.");
      }
      throw new Error(err);
    }
    return typeof payload?.html === "string" ? payload.html : "";
  }
  if (payload?.status !== "ok") {
    const err = payload?.message || "FlareSolverr a échoué";
    if (isFlareChromeCrash(err)) {
      throw new Error("FlareSolverr surchargé (Chrome a planté). Réessaie dans quelques secondes.");
    }
    throw new Error(err);
  }
  return typeof payload?.solution?.response === "string" ? payload.solution.response : "";
}

/** Refuse un HTML Flare d’un autre domaine (session partagée polluée). */
export function flareHtmlMatchesRequest(html = "", requestedUrl = "") {
  let expected = "";
  let pathname = "";
  try {
    const parsed = new URL(requestedUrl);
    expected = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    pathname = parsed.pathname || "";
  } catch {
    return true;
  }
  if (!expected) return true;

  const sample = String(html || "");
  const canon =
    sample.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]
    || sample.match(/property=["']og:url["'][^>]*content=["']([^"']+)/i)?.[1]
    || "";
  if (canon) {
    try {
      const got = new URL(canon).hostname.replace(/^www\./i, "").toLowerCase();
      if (got && got !== expected) return false;
    } catch {
      // ignore
    }
  }

  const expectedRe = new RegExp(expected.replace(/\./g, "\\."), "i");
  const expectedInHtml = expectedRe.test(sample);
  // Empreintes d'autres sources CF — ignorer l'hôte demandé lui-même.
  const competitors = [
    { host: "mangalik.net", re: /mangalik\.net/i },
    { host: "kolnovel.com", re: /kolnovel\.com/i },
    { host: "novelsparadise.site", re: /novelsparadise\./i },
  ];
  for (const competitor of competitors) {
    if (competitor.host === expected || expected.endsWith(`.${competitor.host}`)) continue;
    if (competitor.host.startsWith(expected.split(".")[0] + ".")) continue;
    if (competitor.re.test(sample) && !expectedInHtml) return false;
  }

  // Chapitre Madara : ne pas accepter une page catalogue / fiche du même site.
  const pathParts = pathname.split("/").filter(Boolean);
  const isMadaraChapter = (pathParts[0] === "manga" || pathParts[0] === "series" || pathParts[0] === "manhwa")
    && pathParts.length >= 3
    && pathParts[1] !== "page"
    && pathParts[2] !== "ajax"
    && pathParts[1] !== "ajax";
  const isHentaiChapter = pathParts[0] === "hentai" && pathParts.length >= 3;
  if (isMadaraChapter || isHentaiChapter) {
    const hasChapterBody = /id=["']chapter-heading["']|wp-manga-chapter-img|chapter-image|chapterData|class=["'][^"']*\breading-content\b/i.test(sample);
    if (!hasChapterBody) return false;
  }

  return true;
}

function cookieHeader(cookies = []) {
  return cookies
    .filter((cookie) => cookie && typeof cookie.name === "string" && typeof cookie.value === "string")
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function extractChapterImageUrls(html = "", pageUrl = "") {
  const urls = [];
  const seen = new Set();
  let base = "";
  try {
    base = pageUrl ? new URL(pageUrl).href : "";
  } catch {
    base = "";
  }
  for (const match of String(html).matchAll(/(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']/gi)) {
    const raw = String(match[1] || "").trim();
    if (!raw || seen.has(raw) || raw.startsWith("data:")) continue;
    try {
      const url = base ? new URL(raw, base) : new URL(raw);
      if (url.protocol !== "https:") continue;
      const absolute = url.toString();
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      urls.push(absolute);
    } catch {
      continue;
    }
    if (urls.length >= 40) break;
  }
  return urls;
}

function inlineFlareAssets(html, assets = []) {
  let next = String(html || "");
  for (const asset of assets) {
    const url = String(asset?.url || "").trim();
    const contentType = String(asset?.contentType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
    const base64 = String(asset?.base64 || "").trim();
    if (!url || !base64 || !contentType.startsWith("image/")) continue;
    next = next.split(url).join(`data:${contentType};base64,${base64}`);
  }
  return next;
}

function binaryToBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

async function collectLocalFlareAssets(html, payload, { pageUrl, userAgent }) {
  const cookies = Array.isArray(payload?.solution?.cookies) ? payload.solution.cookies : [];
  const header = cookieHeader(cookies);
  if (!header) return [];
  const referer = (() => {
    try {
      return `${new URL(pageUrl).origin}/`;
    } catch {
      return "";
    }
  })();
  const assets = [];
  for (const imageUrl of extractChapterImageUrls(html, pageUrl)) {
    try {
      const response = await publicFetch(imageUrl, {
        headers: {
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          cookie: header,
          ...(referer ? { referer } : {}),
          "user-agent": userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("image/")) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 2_500_000) continue;
      assets.push({ url: imageUrl, contentType: contentType.split(";")[0].trim(), base64: binaryToBase64(bytes) });
    } catch {
      // Keep the original URL if the image cannot be inlined.
    }
  }
  return assets;
}

export async function fetchHtmlViaFlareSolverr(url, {
  baseUrl,
  apiKey = "",
  basicUser = "",
  basicPassword = "",
  maxTimeout = DEFAULT_TIMEOUT_MS,
  session,
  fetchImpl = fetch,
  includeAssets = false,
} = {}) {
  if (!baseUrl) throw new Error("FlareSolverr non configuré");
  await validatePublicDestination(url);

  return withFlareSlot(async () => {
    if (isFlareHostBlockCooldown(url)) {
      throw new Error("Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.");
    }
    const proxyMode = isFlareProxyUrl(baseUrl);
    const endpoint = buildFlareSolverrEndpoint(baseUrl);
    const body = proxyMode
      ? { url, ...(includeAssets ? { includeAssets: true } : {}) }
      : {
        cmd: "request.get",
        url,
        maxTimeout,
        ...(session ? { session } : {}),
      };

    const headers = { "Content-Type": "application/json" };
    if (!proxyMode && apiKey) headers["X-FlareSolverr-Api-Key"] = apiKey;
    if (!proxyMode && basicUser && basicPassword) {
      headers.Authorization = `Basic ${toBase64(`${basicUser}:${basicPassword}`)}`;
    }

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const timeoutSignal = AbortSignal.timeout(maxTimeout + 15_000);
        const response = await fetchImpl(endpoint, {
          redirect: "error",
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: timeoutSignal,
        });
        const rawText = await readFlareResponseBody(response);
        const payload = parseFlarePayload(rawText);
        if (response.ok === false && !payload.html) {
          throw errorFromFlareResponse(response, payload, rawText);
        }
        const html = extractHtml(payload, proxyMode);
        if (!html) {
          throw new Error("FlareSolverr n'a pas renvoyé de HTML");
        }
        if (isCloudflareChallengeHtml(html)) {
          throw new Error("FlareSolverr : page Cloudflare encore bloquée");
        }
        if (!flareHtmlMatchesRequest(html, url)) {
          throw new Error("FlareSolverr a renvoyé une page d'un autre site");
        }
        if (!includeAssets) return html;
        if (proxyMode) return inlineFlareAssets(html, payload.assets);
        const assets = await collectLocalFlareAssets(html, payload, {
          pageUrl: url,
          userAgent: payload?.solution?.userAgent,
        });
        return inlineFlareAssets(html, assets);
      } catch (error) {
        lastError = error;
        markFlareCrashCooldown(error);
        markFlareHostBlockCooldown(url, error);
        if (attempt < 1 && shouldRetryFlareError(error)) await wait(500);
        else break;
      }
    }
    throw lastError ?? new Error("FlareSolverr indisponible");
  });
}

export async function requireFlareSolverrHtml(url, { includeAssets = false } = {}) {
  const { getFlareSolverrConfig } = await import("./flareSolverrConfig.js");
  const config = getFlareSolverrConfig();
  if (!config?.baseUrl) throw new Error("FlareSolverr non configuré");
  return fetchHtmlViaFlareSolverr(url, { ...config, includeAssets });
}

export async function tryFlareSolverrHtml(url) {
  try {
    return await requireFlareSolverrHtml(url);
  } catch {
    return null;
  }
}

function flareImageEndpoint(baseUrl = "") {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (isFlareProxyUrl(trimmed)) return `${trimmed}/image`;
  return "";
}

function base64ToUint8Array(base64 = "") {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Image derrière Cloudflare (catalogue / couverture) via le proxy Night-Novel. */
export async function fetchImageViaFlareSolverr(imageUrl) {
  await validatePublicDestination(imageUrl);
  const { getFlareSolverrConfig } = await import("./flareSolverrConfig.js");
  const config = getFlareSolverrConfig();
  if (!config?.baseUrl) throw new Error("FlareSolverr non configuré");

  const endpoint = flareImageEndpoint(config.baseUrl);
  if (!endpoint) throw new Error("Proxy Flare image indisponible");

  return withFlareSlot(async () => {
    if (isFlareHostBlockCooldown(imageUrl)) {
      throw new Error("Cloudflare a bloqué l'IP du serveur pour ce site. Réessaie plus tard.");
    }
    const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS + 15_000);
    const response = await fetch(endpoint, {
      redirect: "error",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl }),
      signal: timeoutSignal,
    });
    const rawText = await readFlareResponseBody(response);
    const payload = parseFlarePayload(rawText);
    if (!response.ok && payload?.success !== true) {
      throw errorFromFlareResponse(response, payload, rawText);
    }
    if (payload?.success === false) {
      throw new Error(payload.error || "Image Flare indisponible");
    }
    const contentType = String(payload?.contentType || "image/jpeg").split(";")[0].trim() || "image/jpeg";
    const base64 = String(payload?.base64 || "").trim();
    if (!base64 || !contentType.startsWith("image/")) {
      throw new Error("Image Flare indisponible");
    }
    return {
      kind: "image",
      contentType,
      buffer: base64ToUint8Array(base64),
    };
  });
}
