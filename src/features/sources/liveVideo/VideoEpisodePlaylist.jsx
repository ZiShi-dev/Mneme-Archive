import React, { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { getChapterProgress } from "../../../lib/storage/chapterProgress";
import { formatEpisodeHeaderLabel } from "../mediaPresentation";
import { isChromebookApp } from "../../../config/appFlavor";
import { ThemedScrollbar } from "../../../components/layout/ThemedScrollbar";
import { VIDEO_COMPLETE_THRESHOLD } from "./constants";

export function VideoEpisodePlaylist({
  chapters,
  activeChapter,
  sourceId,
  presentation,
  onSelectChapter,
}) {
  const playlistChapters = useMemo(() => (
    [...chapters].sort((left, right) => {
      const leftNumber = Number(String(left.number || "").replace(/[^\d.]/g, ""));
      const rightNumber = Number(String(right.number || "").replace(/[^\d.]/g, ""));
      if (leftNumber && rightNumber && leftNumber !== rightNumber) return leftNumber - rightNumber;
      return String(left.name || left.number || "").localeCompare(String(right.name || right.number || ""), undefined, { numeric: true });
    })
  ), [chapters]);

  const activePlaylistItemRef = useRef(null);
  const playlistScrollerRef = useRef(null);

  useEffect(() => {
    const scroller = playlistScrollerRef.current;
    const item = activePlaylistItemRef.current;
    if (!scroller || !item) return;
    const offset = item.offsetTop - (scroller.clientHeight - item.clientHeight) / 2;
    scroller.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }, [activeChapter.url]);

  return (
    <aside className="video-watch-playlist" aria-label={presentation.sectionTitle}>
      <div className="video-watch-playlist__head">
        <h2>{presentation.sectionTitle}</h2>
        <span>{chapters.length}</span>
      </div>
      <div className="video-watch-playlist__list" ref={playlistScrollerRef}>
        {playlistChapters.map((entry) => {
          const isActive = entry.url === activeChapter.url
            || (entry.number && String(entry.number) === String(activeChapter.number));
          const entryProgress = getChapterProgress(sourceId, entry.url);
          const entryLabel = formatEpisodeHeaderLabel(entry.number || entry.name, presentation.headerUnit);
          return (
            <button
              key={entry.url}
              ref={isActive ? activePlaylistItemRef : null}
              type="button"
              className={`video-watch-playlist__item${isActive ? " is-active" : ""}${entryProgress >= VIDEO_COMPLETE_THRESHOLD ? " is-complete" : ""}`}
              onClick={() => onSelectChapter(entry)}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="video-watch-playlist__index" aria-hidden="true">
                {entry.number || "—"}
              </span>
              <span className="video-watch-playlist__copy">
                <strong dir="auto">{entryLabel}</strong>
                {entry.name && entry.name !== entry.number ? <small dir="auto">{entry.name}</small> : null}
              </span>
              {entryProgress > 0 && entryProgress < VIDEO_COMPLETE_THRESHOLD ? (
                <span className="video-watch-playlist__progress">{entryProgress}%</span>
              ) : null}
              {entryProgress >= VIDEO_COMPLETE_THRESHOLD ? (
                <Check size={14} className="video-watch-playlist__done" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      {isChromebookApp ? (
        <ThemedScrollbar scrollerRef={playlistScrollerRef} className="desktop-scroll--nested" />
      ) : null}
    </aside>
  );
}
