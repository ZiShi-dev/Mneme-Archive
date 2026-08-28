export const MAX_SEARCH_QUERY_LENGTH = 200;

export function normalizeSearchQuery(raw) {
  const query = String(raw ?? "").trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (query.length < 2) return { query: "", valid: false };
  return { query, valid: true };
}
