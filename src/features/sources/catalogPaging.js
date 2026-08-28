import { getCatalogServerPageSpan, uiPageToServerStartPage } from "../../lib/catalog/catalogLayout.js";

export async function fetchCatalogBatch(fetchPage, uiPage, pageSpan = getCatalogServerPageSpan()) {
  const span = Math.max(1, pageSpan);
  const startPage = uiPageToServerStartPage(uiPage, span);
  const responses = await Promise.all(
    Array.from({ length: span }, (_, index) => fetchPage(startPage + index)),
  );

  const items = [];
  for (const response of responses) {
    if (Array.isArray(response?.items) && response.items.length) {
      items.push(...response.items);
    }
  }

  const lastResponse = responses[responses.length - 1] || {};
  const hasMore = Boolean(lastResponse.hasMore);

  return { items, hasMore };
}

export async function resolvePopulatedCatalogPage(requestedPage, loadPage) {
  const parsed = Math.max(1, Number(requestedPage) || 1);
  const direct = await loadPage(parsed);
  if (direct.items.length) return direct;

  for (let probe = parsed - 1; probe >= 1; probe -= 1) {
    const candidate = await loadPage(probe);
    if (candidate.items.length) {
      return { ...candidate, clampedFrom: parsed };
    }
  }

  return null;
}
