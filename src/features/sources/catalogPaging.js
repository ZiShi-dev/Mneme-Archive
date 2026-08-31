import { getCatalogServerPageSpan, uiPageToServerStartPage } from "../../lib/catalog/catalogLayout.js";
import { usesFlareDirectSource } from "../../lib/platform/webViewSources.js";

export async function fetchCatalogBatch(fetchPage, uiPage, pageSpan = getCatalogServerPageSpan(), { sequential = false } = {}) {
  const span = Math.max(1, pageSpan);
  const startPage = uiPageToServerStartPage(uiPage, span);
  const pages = Array.from({ length: span }, (_, index) => startPage + index);

  const responses = [];
  if (sequential || span === 1) {
    for (const serverPage of pages) {
      try {
        responses.push(await fetchPage(serverPage));
      } catch {
        responses.push({ items: [], hasMore: false });
      }
    }
  } else {
    const settled = await Promise.allSettled(pages.map((serverPage) => fetchPage(serverPage)));
    for (const entry of settled) {
      responses.push(entry.status === "fulfilled" ? entry.value : { items: [], hasMore: false });
    }
  }

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

export function shouldFetchCatalogSequentially(sourceId) {
  return usesFlareDirectSource(sourceId);
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
