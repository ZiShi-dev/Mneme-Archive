import { useState } from "react";
import { resolveBookmarkType } from "../features/sources/contentTypes";
import { scrollAppToTop } from "../lib/platform/scrollRoot";

function resolveScreenFromHistory(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry.startsWith("manga:")) return entry;
  }
  return "home";
}

export function useAppNavigation() {
  const [screen, setScreen] = useState("home");
  const [history, setHistory] = useState(["home"]);
  const [selected, setSelected] = useState(null);
  const [reader, setReader] = useState(null);
  const [selectedLive, setSelectedLive] = useState(null);
  const [liveReader, setLiveReader] = useState(null);

  const navigate = (next) => {
    setSelected(null);
    setReader(null);
    setSelectedLive(null);
    setLiveReader(null);
    setScreen(next);
    setHistory((prev) => [...prev, next]);
    scrollAppToTop({ behavior: "smooth" });
  };

  const openManga = (item) => {
    setSelected(item);
    setReader(null);
    setHistory((prev) => [...prev, `manga:${item.id}`]);
    scrollAppToTop({ behavior: "smooth" });
  };

  const openReader = (item, chapter = item.lastChapter) => {
    setReader({ item, chapter });
    scrollAppToTop();
  };

  const openLiveManga = (item) => {
    setSelectedLive(item);
    setLiveReader(null);
    scrollAppToTop({ behavior: "smooth" });
  };

  const openLiveReader = (item, chapter, options = {}) => {
    const manga = {
      ...item,
      mediaType: resolveBookmarkType(item),
      mediaTypeLabel: item.mediaTypeLabel || undefined,
    };
    setLiveReader({
      manga,
      chapter,
      preferredSourceIndex: options.preferredSourceIndex,
      prefetchData: options.prefetchData,
    });
    scrollAppToTop();
  };

  const goBack = () => {
    if (liveReader) return setLiveReader(null);
    if (selectedLive) return setSelectedLive(null);
    if (reader) return setReader(null);
    if (selected) {
      setSelected(null);
      setHistory((prev) => prev.slice(0, -1));
      return;
    }
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      setScreen(resolveScreenFromHistory(next));
      scrollAppToTop({ behavior: "smooth" });
      return next;
    });
  };

  const isOverlayOpen = Boolean(liveReader || reader || selectedLive || selected);

  return {
    screen,
    history,
    selected,
    reader,
    selectedLive,
    liveReader,
    navigate,
    openManga,
    openReader,
    openLiveManga,
    openLiveReader,
    goBack,
    isOverlayOpen,
  };
}
