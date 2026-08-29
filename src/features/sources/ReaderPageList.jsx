import React, { useCallback, useEffect, useState } from "react";
import { SourcePageImage } from "./SourcePageImage";

export function ReaderPageList({ sourceId, pages, onFirstPageReady }) {
  const [loadThroughIndex, setLoadThroughIndex] = useState(0);

  useEffect(() => {
    setLoadThroughIndex(0);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pages]);

  const handlePageSettled = useCallback((index) => {
    if (index === 0) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      onFirstPageReady?.();
    }
    setLoadThroughIndex((current) => {
      if (index < current) return current;
      if (index >= pages.length - 1) return current;
      return index + 1;
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
