import { decodeHtml, textOnly } from "../lib/htmlUtils.js";
import { applyRecentChapterFields } from "../lib/catalogChapters.js";
import { mergeCatalogByRecency } from "../lib/catalogMerge.js";
import { collectCatalogPool } from "../lib/catalogPool.js";
import {
  absoluteMediaUrl,
  assertFilterPath,
  buildCatalogUrl,
  buildSearchUrl,
  catalogHasMore,
  DEFAULT_BASE_URL,
  DEFAULT_CTX,
  isAllowedHost,
  isMixedCatalogPath,
  isSeriesCard,
  MIXED_PATH,
  MOVIES_PATH,
  normalizeWiflixAudioLabel,
  normalizeWiflixUrl,
  parseLatestEpisode,
  SERIES_PATH,
  seriesCatalogChapters,
  SOURCE_ID,
  SOURCE_NAME,
  watchEntry,
  watchSlugFromUrl,
  wiflixContext,
  WIFLIX_UPSTREAM_PAGE_HINT,
} from "./wiflixCore.js";

export const WIFLIX_CATALOG_PAGE_SIZE = 20;
const WIFLIX_FILTERS_CACHE_TTL_MS = 30 * 60_000;
const WIFLIX_SEARCH_CACHE_TTL_MS = 60_000;
const wiflixFiltersCache = new Map();
const wiflixSearchCache = new Map();

export function parseWiflixCatalog(html = "", ctx = DEFAULT_CTX) {
  const results = [];
  const seen = new Set();
  const starts = [...html.matchAll(/<div class="mov clearfix">/gi)];
  starts.forEach((match, index) => {
    const block = html.slice(match.index, starts[index + 1]?.index ?? html.length);
    const href = block.match(/<a[^>]*class="[^"]*mov-t[^"]*"[^>]*href="([^"]+)"/i)?.[1]
      || block.match(/data-link="([^"]+)"/i)?.[1]
      || "";
    const url = normalizeWiflixUrl(href, ctx);
    const slug = watchSlugFromUrl(url, ctx);
    if (!url || !slug || seen.has(slug)) return;
    const title = textOnly(
      block.match(/<a[^>]*class="[^"]*mov-t[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1]
        || block.match(/alt="([^"]+)"/i)?.[1]
        || "",
    );
    if (!title) return;
    seen.add(slug);
    const cover = absoluteMediaUrl(block.match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? "", ctx);
    const movL = textOnly(block.match(/<div class="mov-l">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const year = textOnly(block.match(/<span class="nbloc1">([\s\S]*?)<\/span>/i)?.[1] ?? "")
      || (/^\d{4}$/.test(movL) ? movL : "");
    const audioLabel = normalizeWiflixAudioLabel(movL);
    const series = isSeriesCard(block, title);
    const latestEpisode = series ? parseLatestEpisode(block) : 0;
    const chapters = series
      ? seriesCatalogChapters(url, latestEpisode, ctx)
      : [watchEntry(url, "1")];
    results.push(applyRecentChapterFields({
      id: slug,
      title,
      altTitle: [audioLabel, year].filter(Boolean).join(" · "),
      url,
      cover,
      summary: "",
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: series ? "series" : "movie",
      mediaTypeLabel: series ? "مسلسل" : "فيلم",
      audioLabel,
      year,
    }, chapters));
  });
  return results;
}

export function parseWiflixFilters(html = "", baseUrl = DEFAULT_BASE_URL) {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try { target = new URL(href, baseUrl); } catch { continue; }
    if (!isAllowedHost(target.hostname)) continue;
    const path = `${target.pathname}${target.pathname.endsWith("/") ? "" : "/"}`;
    const name = textOnly(match[2]).replace(/^#/, "").trim();
    if (!name || name.length > 40) continue;
    const genre = path.match(/^\/genre\/([a-z0-9&%_.-]+)\/$/i)?.[1];
    if (genre) {
      const key = `category:${genre.toLowerCase()}`;
      if (seen.category.has(key)) continue;
      seen.category.add(key);
      categories.push({ slug: genre, name, count: 0, filterPath: `/genre/${genre}/` });
      continue;
    }
    const year = path.match(/^\/annee\/(\d{4})\/$/i)?.[1];
    if (year) {
      const key = `tag:year:${year}`;
      if (seen.tag.has(key)) continue;
      seen.tag.add(key);
      tags.push({ slug: year, name, count: 0, filterPath: `/annee/${year}/` });
    }
  }
  tags.sort((left, right) => Number(right.slug) - Number(left.slug));
  return { categories, tags };
}

export function relatedWiflixSearchQuery(title = "") {
  return String(title || "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*[-–—]?\s*saison\s+\d+\b.*$/i, "")
    .trim();
}

function normalizeTitleKey(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function wiflixSearchVariants(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const normalized = raw
    .replace(/\bs(?:aison)?\s*(\d+)\s*$/i, "saison $1")
    .replace(/\s+/g, " ")
    .trim();
  const variants = [raw, normalized];
  const saison = normalized.match(/^(.+?)\s+saison\s+(\d+)$/i);
  if (saison) {
    variants.push(`${saison[1].trim()}-saison-${saison[2]}`);
    variants.push(`${saison[1].trim()} - Saison ${saison[2]}`);
  }
  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 1 && /^[a-z0-9]+$/i.test(words[0])) {
    variants.push(`${words[0]}-saison`);
  }
  const hyphen = normalized.replace(/\s+/g, "-");
  if (hyphen !== normalized) variants.push(hyphen);
  return [...new Set(variants.map((entry) => entry.trim()).filter(Boolean))];
}

export function wiflixSearchScore(title = "", query = "") {
  const tokens = normalizeTitleKey(title).split(" ").filter(Boolean);
  const queryTokens = normalizeTitleKey(String(query).replace(/-/g, " ")).split(" ").filter(Boolean);
  if (!tokens.length || !queryTokens.length) return 99;
  const titleKey = tokens.join(" ");
  const queryKey = queryTokens.join(" ");
  if (titleKey === queryKey) return 0;
  if (queryTokens.length === 1 && tokens[0] === queryTokens[0] && tokens[1] === "saison") return 1;
  if (tokens[0] === queryTokens[0] && queryTokens.every((part, index) => tokens[index] === part)) return 1;
  if (tokens[0] === queryTokens[0]) return 2;
  if (queryTokens.every((part) => tokens.includes(part))) return 3;
  if (titleKey.includes(queryKey)) return 4;
  return 5;
}

function seasonNumberFromTitle(title = "") {
  const match = String(title).match(/saison\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function rankWiflixSearch(items = [], query = "") {
  return [...items].sort((left, right) => wiflixSearchScore(left.title, query) - wiflixSearchScore(right.title, query)
    || seasonNumberFromTitle(right.title) - seasonNumberFromTitle(left.title)
    || String(left.title).localeCompare(String(right.title)));
}

function mergeWiflixItems(groups = []) {
  const seen = new Set();
  const items = [];
  for (const group of groups) {
    for (const item of group || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function isRelatedWiflixTitle(currentTitle, candidateTitle, query) {
  const current = normalizeTitleKey(currentTitle);
  const candidate = normalizeTitleKey(candidateTitle);
  const needle = normalizeTitleKey(query);
  if (!candidate || candidate === current) return false;
  if (needle && (candidate === needle || candidate.startsWith(`${needle} `))) return true;
  const currentWords = current.split(" ").filter(Boolean);
  const candidateWords = candidate.split(" ").filter(Boolean);
  return currentWords.length >= 2
    && candidateWords.length >= 2
    && currentWords[0] === candidateWords[0]
    && currentWords[1] === candidateWords[1];
}

export function pickRelatedWiflixItems(items = [], { currentId, currentTitle, query, mediaType, limit = 12 } = {}) {
  const seen = new Set([String(currentId || "")]);
  const related = [];
  for (const item of items) {
    if (!item?.id || seen.has(String(item.id))) continue;
    if (mediaType && item.mediaType !== mediaType) continue;
    if (!isRelatedWiflixTitle(currentTitle, item.title, query)) continue;
    seen.add(String(item.id));
    related.push(item);
  }
  return related
    .sort((left, right) => seasonNumberFromTitle(left.title) - seasonNumberFromTitle(right.title)
      || Number(left.year || 0) - Number(right.year || 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      altTitle: item.altTitle || item.year || "",
      url: item.url,
      cover: item.cover,
      source: SOURCE_NAME,
      sourceId: SOURCE_ID,
      mediaType: item.mediaType || mediaType || "movie",
      mediaTypeLabel: item.mediaTypeLabel || (item.mediaType === "series" ? "مسلسل" : "فيلم"),
      year: item.year || (/^\d{4}$/.test(String(item.altTitle || "")) ? item.altTitle : ""),
    }));
}

async function fetchWiflixCatalogUpstream(upstreamPage, filterPath, fetchHtml, baseUrl) {
  const html = await fetchHtml(buildCatalogUrl(upstreamPage, filterPath, baseUrl));
  const ctx = wiflixContext(baseUrl);
  return {
    html,
    items: parseWiflixCatalog(html, ctx),
    hasMore: catalogHasMore(html, upstreamPage),
  };
}

async function fetchWiflixMixedCatalogUpstream(upstreamPage, fetchHtml, baseUrl) {
  const ctx = wiflixContext(baseUrl);
  if (upstreamPage <= 1) {
    const [homeHtml, films, series] = await Promise.all([
      fetchHtml(`${baseUrl}/`),
      fetchWiflixCatalogUpstream(1, MOVIES_PATH, fetchHtml, baseUrl),
      fetchWiflixCatalogUpstream(1, SERIES_PATH, fetchHtml, baseUrl),
    ]);
    return {
      items: parseWiflixCatalog(homeHtml, ctx),
      hasMore: films.hasMore || series.hasMore,
    };
  }
  const [films, series] = await Promise.all([
    fetchWiflixCatalogUpstream(upstreamPage, MOVIES_PATH, fetchHtml, baseUrl),
    fetchWiflixCatalogUpstream(upstreamPage, SERIES_PATH, fetchHtml, baseUrl),
  ]);
  return {
    items: mergeCatalogByRecency(films.items, series.items),
    hasMore: films.hasMore || series.hasMore,
  };
}

export async function fetchWiflixCatalogPage(ctx, fetchHtml, { page = 1, filterPath = MIXED_PATH } = {}) {
  const normalized = assertFilterPath(filterPath?.trim() || MIXED_PATH);
  const offset = (page - 1) * WIFLIX_CATALOG_PAGE_SIZE;
  const maxUpstreamEnd = page + 6;

  if (isMixedCatalogPath(normalized) && page === 1) {
    const mixed = await fetchWiflixMixedCatalogUpstream(1, fetchHtml, ctx.baseUrl);
    const items = mixed.items.slice(0, WIFLIX_CATALOG_PAGE_SIZE);
    return {
      items,
      page,
      filterPath: normalized,
      hasMore: mixed.hasMore || items.length === WIFLIX_CATALOG_PAGE_SIZE,
      fetchedAt: new Date().toISOString(),
    };
  }

  const mixedOffset = isMixedCatalogPath(normalized) ? Math.max(0, offset - WIFLIX_CATALOG_PAGE_SIZE) : offset;
  const mixedStartPage = isMixedCatalogPath(normalized) ? 2 : 1;
  const fetchUpstream = isMixedCatalogPath(normalized)
    ? (upstreamPage) => fetchWiflixMixedCatalogUpstream(upstreamPage + mixedStartPage - 1, fetchHtml, ctx.baseUrl)
    : (upstreamPage) => fetchWiflixCatalogUpstream(upstreamPage, normalized, fetchHtml, ctx.baseUrl);
  const collected = await collectCatalogPool(fetchUpstream, {
    offset: mixedOffset,
    pageSize: WIFLIX_CATALOG_PAGE_SIZE,
    maxUpstreamEnd,
    upstreamPageHint: WIFLIX_UPSTREAM_PAGE_HINT,
  });
  const items = collected.sliced
    ? collected.pool.slice(0, WIFLIX_CATALOG_PAGE_SIZE)
    : collected.pool.slice(offset, offset + WIFLIX_CATALOG_PAGE_SIZE);
  const hasMoreUpstream = collected.hasMoreUpstream;

  return {
    items,
    page,
    filterPath: normalized,
    hasMore: items.length === WIFLIX_CATALOG_PAGE_SIZE && (
      collected.sliced
        ? collected.pool.length > WIFLIX_CATALOG_PAGE_SIZE || hasMoreUpstream
        : collected.pool.length > offset + items.length || hasMoreUpstream
    ),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchWiflixFilters(fetchHtml, baseUrl) {
  const cached = wiflixFiltersCache.get(baseUrl);
  if (cached && Date.now() - cached.at < WIFLIX_FILTERS_CACHE_TTL_MS) return cached.data;
  const html = await fetchHtml(`${baseUrl}${MOVIES_PATH}`);
  const parsed = parseWiflixFilters(html, baseUrl);
  const data = {
    kinds: [
      { slug: "all", name: "الكل", filterPath: MIXED_PATH },
      { slug: "movies", name: "أفلام", filterPath: MOVIES_PATH },
      { slug: "series", name: "مسلسلات", filterPath: SERIES_PATH },
    ],
    categories: parsed.categories,
    tags: parsed.tags,
    fetchedAt: new Date().toISOString(),
  };
  wiflixFiltersCache.set(baseUrl, { at: Date.now(), data });
  return data;
}

export function clearWiflixCatalogCaches() {
  wiflixFiltersCache.clear();
  wiflixSearchCache.clear();
}

async function fetchSearchHtmlCached(fetchHtml, query, baseUrl, page = 1) {
  const key = `${baseUrl}|${page}|${query}`;
  const cached = wiflixSearchCache.get(key);
  if (cached && Date.now() - cached.at < WIFLIX_SEARCH_CACHE_TTL_MS) {
    return cached.html;
  }
  const html = await fetchHtml(buildSearchUrl(query, page, baseUrl));
  wiflixSearchCache.set(key, { at: Date.now(), html });
  return html;
}

export async function searchWiflix(fetchHtml, query, page = 1, baseUrl = DEFAULT_BASE_URL) {
  const ctx = wiflixContext(baseUrl);
  const variants = wiflixSearchVariants(query);
  const primary = variants[0] || query;
  if (page > 1) {
    const html = await fetchSearchHtmlCached(fetchHtml, primary, baseUrl, page);
    return {
      items: rankWiflixSearch(parseWiflixCatalog(html, ctx), query),
      hasMore: catalogHasMore(html, page),
    };
  }

  const variantHtml = await Promise.all(
    variants.slice(0, 3).map((variant) => fetchSearchHtmlCached(fetchHtml, variant, baseUrl, 1)),
  );
  let items = mergeWiflixItems(variantHtml.map((html) => parseWiflixCatalog(html, ctx)));
  const singleWord = normalizeTitleKey(primary).split(" ").filter(Boolean).length === 1;
  const hasStrongMatch = items.some((item) => wiflixSearchScore(item.title, query) <= 1);
  const extraPages = singleWord && !hasStrongMatch ? 3 : 1;
  const pageHtml = extraPages > 1
    ? await Promise.all([2, 3].map((entry) => fetchSearchHtmlCached(fetchHtml, primary, baseUrl, entry)))
    : [];
  items = rankWiflixSearch(mergeWiflixItems([
    items,
    ...pageHtml.map((html) => parseWiflixCatalog(html, ctx)),
  ]), query);
  const lastHtml = pageHtml[pageHtml.length - 1] || variantHtml[0] || "";
  return {
    items,
    hasMore: extraPages > 1 ? catalogHasMore(lastHtml, extraPages) : catalogHasMore(variantHtml[0] || "", 1),
  };
}

export async function fetchRelatedWiflixItems(fetchHtml, title, currentId, mediaType, baseUrl = DEFAULT_BASE_URL) {
  const query = relatedWiflixSearchQuery(title);
  if (query.length < 3) return [];
  try {
    const { items } = await searchWiflix(fetchHtml, query, 1, baseUrl);
    return pickRelatedWiflixItems(items, {
      currentId,
      currentTitle: title,
      query,
      mediaType,
    });
  } catch {
    return [];
  }
}
