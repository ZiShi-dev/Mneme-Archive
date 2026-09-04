import React, { useCallback, useEffect, useState } from "react";
import { SourcePageImage } from "./SourcePageImage";
import { getReaderImageBudget } from "../../lib/platform/dataSaver.js";
import { scrollReaderTo } from "../../lib/platform/scrollRoot.js";

function initialLoadThrough(pages) {
  const { initialWindow } = getReaderImageBudget();
  return Math.min(initialWindow - 1, Math.max(0, pages.length - 1));
}

export function ReaderPageList({ sourceId, pages, onFirstPageReady }) {
  const [loadThroughIndex, setLoadThroughIndex] = useState(() => initialLoadThrough(pages));

  useEffect(() => {
    setLoadThroughIndex(initialLoadThrough(pages));
    scrollReaderTo(0);
  }, [pages]);

  const handlePageSettled = useCallback((index) => {
    if (index === 0) {
      scrollReaderTo(0);
      onFirstPageReady?.();
    }
    setLoadThroughIndex((current) => {
      if (pages.length <= 0) return current;
      const { unlockBatch } = getReaderImageBudget();
      const next = Math.max(current, index + unlockBatch);
      return Math.min(next, pages.length - 1);
    });
  }, [pages.length, onFirstPageReady]);

  return (
    <>
      {pages.map((page, index) => (
        <div
          key={`${page.src}-${index}`}
          className="live-reader-pages__page"
          data-page-index={index}
        >
          {index <= loadThroughIndex ? (
            <SourcePageImage
              sourceId={sourceId}
              page={page}
              index={index}
              onSettled={() => handlePageSettled(index)}
            />
          ) : null}
        </div>
      ))}
    </>
  );
}
