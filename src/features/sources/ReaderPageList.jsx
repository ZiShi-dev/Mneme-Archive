import React, { useCallback, useEffect, useState } from "react";
import { SourcePageImage } from "./SourcePageImage";
import { scrollReaderTo } from "../../lib/platform/scrollRoot.js";

const INITIAL_PRELOAD_COUNT = 3;

export function ReaderPageList({ sourceId, pages, onFirstPageReady }) {
  const initialThrough = Math.min(INITIAL_PRELOAD_COUNT - 1, Math.max(0, pages.length - 1));
  const [loadThroughIndex, setLoadThroughIndex] = useState(initialThrough);

  useEffect(() => {
    setLoadThroughIndex(Math.min(INITIAL_PRELOAD_COUNT - 1, Math.max(0, pages.length - 1)));
    scrollReaderTo(0);
  }, [pages]);

  const handlePageSettled = useCallback((index) => {
    if (index === 0) {
      scrollReaderTo(0);
      onFirstPageReady?.();
    }
    setLoadThroughIndex((current) => {
      if (pages.length <= 0) return current;
      const next = Math.max(current, index + 1);
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
