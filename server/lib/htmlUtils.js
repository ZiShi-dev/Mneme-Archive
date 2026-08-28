export function decodeHtml(value = "") {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ").trim();
}

export function textOnly(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

export function parseDetailTaxonomies(html, baseUrl) {
  const categories = [];
  const tags = [];
  const seenCategories = new Set();
  const seenTags = new Set();
  const add = (collection, seen, value) => {
    const label = textOnly(value).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/^#/, "").trim();
    const key = label.toLocaleLowerCase("ar");
    if (!label || label.length > 60 || seen.has(key)) return;
    seen.add(key);
    collection.push(label);
  };

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const href = decodeHtml(attributes.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    if (!href) continue;
    let target;
    try { target = new URL(href, baseUrl); } catch { continue; }
    const pathname = target.pathname.toLowerCase();
    const itemProp = attributes.match(/itemprop\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (itemProp === "genre" || /(?:^|\/)(?:manga-|novel-)?(?:genre|genres|category|categories)(?:\/|$)/i.test(pathname)) add(categories, seenCategories, match[2]);
    else if (["tag", "keywords"].includes(itemProp) || /(?:^|\/)(?:manga-|novel-)?(?:tag|tags)(?:\/|$)/i.test(pathname)) add(tags, seenTags, match[2]);
  }

  return { categories: categories.slice(0, 30), tags: tags.slice(0, 40) };
}

export function parseTaxonomyFilterLinks(html, baseUrl, allowedHosts) {
  const categories = [];
  const tags = [];
  const seen = { category: new Set(), tag: new Set() };
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeHtml(match[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
    const itemProp = match[1].match(/itemprop\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    let target;
    try { target = new URL(href, baseUrl); } catch { continue; }
    if (!allowedHosts.includes(target.hostname)) continue;
    const parts = target.pathname.split("/").filter(Boolean);
    const categoryIndex = parts.findIndex((part) => /^(?:(?:manga|novel)-)?(?:genre|genres|category|categories)$/i.test(part));
    const tagIndex = parts.findIndex((part) => /^(?:(?:manga|novel)-)?tags?$/i.test(part));
    const categoryQuery = ["genres", "genre", "category"].find((key) => target.searchParams.has(key));
    const tagQuery = ["tags", "tag"].find((key) => target.searchParams.has(key));
    const type = itemProp === "genre" || categoryIndex >= 0 || categoryQuery ? "category" : ["tag", "keywords"].includes(itemProp) || tagIndex >= 0 || tagQuery ? "tag" : "";
    if (!type) continue;
    const taxonomyIndex = type === "category" ? categoryIndex : tagIndex;
    const queryParam = type === "category" ? categoryQuery : tagQuery;
    const queryValue = queryParam ? target.searchParams.get(queryParam)?.replace(/^\+/, "") || "" : "";
    const slug = decodeURIComponent(queryValue || (taxonomyIndex >= 0 ? parts[taxonomyIndex + 1] || "" : parts.at(-1) || "")).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
    const name = textOnly(match[2]).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/^#/, "").trim();
    const key = `${type}:${slug}:${name.toLocaleLowerCase("ar")}`;
    if (!slug || !name || name.length > 60 || seen[type].has(key)) continue;
    seen[type].add(key);
    const entry = { slug, name, count: 0, filterPath: target.pathname, queryParam: queryParam || "", queryValue };
    (type === "category" ? categories : tags).push(entry);
  }
  return { categories, tags };
}

export function mergeFilterGroups(groups, limit = 60) {
  const merged = { categories: new Map(), tags: new Map() };
  for (const group of groups) for (const type of ["categories", "tags"]) for (const entry of group[type] || []) {
    const key = entry.name.toLocaleLowerCase("ar");
    if (!merged[type].has(key)) merged[type].set(key, entry);
  }
  return { categories: [...merged.categories.values()].slice(0, limit), tags: [...merged.tags.values()].slice(0, limit) };
}
