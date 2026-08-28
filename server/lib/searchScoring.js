export function normalizeSearchKey(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a = "", b = "") {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = rows[0];
    rows[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = rows[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[j] = Math.min(
        rows[j] + 1,
        rows[j - 1] + 1,
        previous + cost,
      );
      previous = temp;
    }
  }
  return rows[b.length];
}

function bestTokenScore(needle, hayTokens) {
  if (!needle) return 0;
  let best = 0;
  const shortNeedle = needle.length <= 3;

  for (const hay of hayTokens) {
    if (!hay) continue;
    if (hay === needle) {
      best = Math.max(best, 1);
      continue;
    }
    if (!shortNeedle && (hay.includes(needle) || needle.includes(hay))) {
      best = Math.max(best, 0.9);
      continue;
    }
    const maxDist = shortNeedle
      ? 1
      : Math.max(1, Math.ceil(Math.max(needle.length, hay.length) * 0.34));
    const dist = levenshtein(needle, hay);
    if (dist <= maxDist) {
      best = Math.max(best, 1 - dist / Math.max(needle.length, hay.length));
    }
  }

  return best;
}

export function resolveSearchMinScore(query = "") {
  const tokens = normalizeSearchKey(query).split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) return 0.55;
  if (tokens.length === 1 && tokens[0].length >= 5) return 0.5;
  return 0.45;
}

export function seasonNumberFromTitle(title = "") {
  const match = String(title).match(/(?:saison|season)\s*(\d+)/i) || String(title).match(/\bs(?:eason)?\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

export function scoreSearchItem(item, query) {
  const haystack = normalizeSearchKey(`${item.title || ""} ${item.altTitle || item.subtitle || ""}`);
  const needle = normalizeSearchKey(query);
  if (!needle || !haystack) return 0;

  const needleTokens = needle.split(/\s+/).filter(Boolean);
  const hayTokens = haystack.split(/\s+/).filter(Boolean);
  if (!needleTokens.length) return 0;
  if (haystack === needle) return 1;

  const prefixMatch = needleTokens.every((token, index) => hayTokens[index] === token);
  if (prefixMatch) {
    const next = hayTokens[needleTokens.length];
    if (!next) return 1;
    if (next === "saison" || next === "season" || next === "s") return 0.995;
    return 0.97;
  }

  const tokenScores = needleTokens.map((token) => bestTokenScore(token, hayTokens));
  const average = tokenScores.reduce((sum, score) => sum + score, 0) / needleTokens.length;
  const minimum = Math.min(...tokenScores);

  if (needleTokens.length === 1) {
    if (hayTokens.includes(needleTokens[0])) return 0.82;
    return average;
  }

  return minimum * 0.5 + average * 0.5;
}

export function rankSearchResults(items = [], query, { minScore, limit = 24 } = {}) {
  const threshold = minScore ?? resolveSearchMinScore(query);
  const seen = new Set();
  const ranked = [];

  for (const item of items) {
    const key = item.url || `${item.title}:${item.sourceId || ""}`;
    if (!key || seen.has(key)) continue;
    const score = scoreSearchItem(item, query);
    if (score < threshold) continue;
    seen.add(key);
    ranked.push({ item, score });
  }

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const seasonDelta = seasonNumberFromTitle(right.item.title) - seasonNumberFromTitle(left.item.title);
    if (seasonDelta) return seasonDelta;
    return String(left.item.title || "").localeCompare(String(right.item.title || ""), "fr", { sensitivity: "base" });
  });

  return ranked.slice(0, limit).map((entry) => entry.item);
}

const VARIANT_SWAPS = "haeiouywckr";

function pushVariant(seen, ranked, value) {
  if (!value || value.length < 2 || seen.has(value)) return;
  seen.add(value);
  ranked.push(value);
}

export function buildSearchVariants(query, { max = 14 } = {}) {
  const normalized = normalizeSearchKey(query);
  if (!normalized) return [];

  const seen = new Set();
  const ranked = [];
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2);

  pushVariant(seen, ranked, normalized);

  for (const token of tokens) {
    pushVariant(seen, ranked, token);

    if (token.length >= 3) {
      for (const replacement of VARIANT_SWAPS) {
        if (replacement === token.at(-1)) continue;
        pushVariant(seen, ranked, token.slice(0, -1) + replacement);
      }
    }

    for (let index = 0; index < token.length; index += 1) {
      const removed = token.slice(0, index) + token.slice(index + 1);
      if (removed.length >= 3) pushVariant(seen, ranked, removed);
    }

    if (token.length <= 6) {
      for (let index = 0; index < token.length; index += 1) {
        for (const replacement of VARIANT_SWAPS) {
          if (replacement === token[index]) continue;
          pushVariant(seen, ranked, token.slice(0, index) + replacement + token.slice(index + 1));
        }
      }
    }

    if (token.includes("ei")) pushVariant(seen, ranked, token.replace("ei", "i"));
    if (token.includes("ie")) pushVariant(seen, ranked, token.replace("ie", "i"));
    if (token.endsWith("ik")) pushVariant(seen, ranked, `${token.slice(0, -1)}ck`);
  }

  return ranked.slice(0, max);
}

export function pickVariantQueries(query, max = 4) {
  const normalized = normalizeSearchKey(query);
  if (!normalized) return [];

  const all = buildSearchVariants(query).filter((variant) => variant !== normalized);
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2);
  const tokenSet = new Set(tokens);
  const prioritized = [];

  for (const token of tokens) {
    if (!prioritized.includes(token)) prioritized.push(token);
  }

  for (const variant of all) {
    if (tokenSet.has(variant) || prioritized.includes(variant)) continue;
    const matchesTokenEdit = tokens.some((token) => (
      variant.length === token.length && levenshtein(variant, token) === 1
    ));
    if (matchesTokenEdit) prioritized.push(variant);
  }

  for (const variant of all) {
    if (!prioritized.includes(variant)) prioritized.push(variant);
  }

  return prioritized.slice(0, max);
}

export function pickTypoFallbackQueries(query, max = 2) {
  const normalized = normalizeSearchKey(query);
  if (!normalized) return [];

  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length >= 2));
  return pickVariantQueries(query, 8)
    .filter((variant) => !tokens.has(variant))
    .slice(0, max);
}

export function shouldExpandSearchVariants(items = [], query = "") {
  const normalized = normalizeSearchKey(query);
  if (!normalized) return false;
  if (!items.length) return true;
  if (normalized.includes(" ")) {
    const best = Math.max(...items.map((item) => scoreSearchItem(item, query)));
    return best < 0.72;
  }
  return items.length < 3;
}
