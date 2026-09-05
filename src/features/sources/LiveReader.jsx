import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowRight, BookOpen, Check, Wifi } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { useChapterCompletion } from "../../hooks/useChapterCompletion";
import {
  computeReaderScrollProgress,
  getChapterScrollKey,
  restoreReaderScrollToProgress,
} from "../../lib/readingProgress";
import { getChapterProgress, setChapterProgress } from "../../lib/storage/chapterProgress";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useReaderPagePreload } from "../../hooks/useReaderPagePreload";
import { DEFAULT_APP_SETTINGS } from "../../lib/settings/defaults";
import { fetchSourceChapter, fetchSourceDetails, formatSourceError, peekSourceChapter } from "./sourceApi";
import { runAppPullRefresh } from "../../lib/platform/appRefresh";
import { normalizeChapterList } from "../../../server/lib/chapterOrdering.js";
import { normalizeRealmChapterList } from "../../lib/media/chapterLock";
import { resolveBookmarkType } from "./contentTypes";
import { getMediaPresentation, resolveVideoPlayback } from "./mediaPresentation";
import { ReaderPageList } from "./ReaderPageList";
import { UnlockCountdown } from "../../components/media/UnlockCountdown";
import { isAzoraFlySource } from "../../lib/media/chapterLock";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderEpisodeHeader } from "./liveReader/ReaderEpisodeHeader";
import { ReaderEpisodeToolbar } from "./liveReader/ReaderEpisodeToolbar";
import { ReaderPlaybackControls } from "./ReaderPlaybackControls";
import { ReaderChapterListSheet } from "./ReaderChapterListSheet";
import { ReaderSettingsSheet } from "./ReaderSettingsSheet";
import { EmbedPlayerFrame } from "./EmbedPlayerFrame";
import { installEmbedPopupGuards } from "../../lib/video/embedHosts";
import { useI18n } from "../../i18n/I18nProvider";
import { resolveNovelContentDirection } from "../../lib/text/contentDirection.js";
import { NovelReaderSkeleton, ReaderPagesSkeleton, VideoStageSkeleton } from "../../components/ui/ContentSkeleton";
import {
  addReaderScrollListener,
  getMaxScrollTop,
  getScrollTop,
  scrollReaderBy,
  scrollReaderTo,
} from "../../lib/platform/scrollRoot.js";
import { resolveBottomNavScrollHidden } from "../../lib/platform/bottomNavChrome.js";
import { setNativeImmersive } from "../../lib/video/nativeImmersive.js";
import { PullToRefreshIndicator } from "../../components/ui/PullToRefreshIndicator";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { isNativeMobileApp } from "../../lib/platform/nativeAppLayout";
import { prefetchReaderChapter, resolveReaderChapterCache } from "../../lib/reading/readerChapterCache.js";
import { getOfflineChapterByRefs } from "../../lib/downloads/offlineChapterStore.js";
import { estimateNovelDownloadBatch } from "../../lib/downloads/estimateNovelDownloadSizeWithCache.js";
import { isChapterOfflineStatus } from "../../lib/downloads/useNovelDownloads.js";
import { useNovelDownloads } from "../../lib/downloads/useNovelDownloads.js";
import { NovelDownloadConfirmDialog } from "./details/NovelDownloadConfirmDialog";

const scrollSpeeds = [0.5, 1, 1.5, 2];
const defaultReaderPreferences = { theme: "night", fontSize: 18, lineHeight: 1.9, fontFamily: "naskh", textAlign: "right", paragraphSpacing: 1.25, contentWidth: "normal" };
const readerPreferencesKey = "living-archive:reader-preferences";

export function LiveReader({
  manga,
  chapter,
  prefetchData,
  onBack,
  onOpenDetails,
  isFavorite,
  onToggleFavorite,
  onSaveProgress,
  readerSettings = DEFAULT_APP_SETTINGS,
}) {
  const { pushToast } = useToast();
  const { t, dir } = useI18n();
  const novelDownloads = useNovelDownloads();
  const sourceId = resolveSourceId(manga);
  const profile = getSourceProfile(sourceId);
  const expectsNovel = useMemo(() => resolveBookmarkType(manga) === "novel", [manga]);
  const initialChapterBootstrapRef = useRef(null);
  if (!initialChapterBootstrapRef.current) {
    initialChapterBootstrapRef.current = resolveReaderChapterCache(sourceId, chapter, {
      prefetchData,
      manga,
    });
  }
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(manga.recentChapters || [chapter]);
  const [chaptersLoading, setChaptersLoading] = useState(() => !(manga.chapters?.length || manga.recentChapters?.length > 1));
  const [data, setData] = useState(() => initialChapterBootstrapRef.current.data);
  const [loadingChapter, setLoadingChapter] = useState(() => !initialChapterBootstrapRef.current.data);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [controlsMode, setControlsMode] = useState("panel");
  const [headerChromeVisible, setHeaderChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chapterListOpen, setChapterListOpen] = useState(false);
  const [chapterDownloading, setChapterDownloading] = useState(false);
  const [downloadConfirm, setDownloadConfirm] = useState(null);
  const [readerPreferences, setReaderPreferences] = usePersistedState(readerPreferencesKey, defaultReaderPreferences);
  const readerChromeHiddenRef = useRef(false);
  const readerBodyRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const restoringRef = useRef(false);
  const progressKey = `living-archive:chapter-progress:${sourceId}:${activeChapter.url}`;

  const restorePendingScroll = useCallback(() => {
    if (pendingSeekRef.current == null) return;
    const saved = pendingSeekRef.current;
    const attempt = (retries = 0) => {
      const maximum = getMaxScrollTop();
      if (maximum <= 0 && retries < 10) {
        window.setTimeout(() => attempt(retries + 1), 60);
        return;
      }
      pendingSeekRef.current = null;
      restoringRef.current = true;
      const restored = restoreReaderScrollToProgress(saved, { behavior: "auto" });
      setProgress(restored);
      window.setTimeout(() => {
        restoringRef.current = false;
      }, 120);
    };
    window.setTimeout(() => attempt(), 40);
  }, []);

  const hideReaderChrome = useCallback(() => {
    readerChromeHiddenRef.current = true;
    setHeaderChromeVisible(false);
    setControlsMode("hidden");
  }, []);

  const showReaderChrome = useCallback(() => {
    readerChromeHiddenRef.current = false;
    setHeaderChromeVisible(true);
    setControlsMode("panel");
  }, []);

  // Lecteur manga/roman : plein écran immersif ; les safe-areas natives
  // se mettent à jour quand la barre d'info / la nav système apparaît.
  const readerImmersive = !settingsOpen && !chapterListOpen;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await setNativeImmersive(readerImmersive);
    })();
    return () => {
      cancelled = true;
      setNativeImmersive(false).catch(() => {});
    };
  }, [readerImmersive]);

  const handleChapterComplete = useCallback(() => {
    const finalProgress = Math.max(computeReaderScrollProgress(), 100);
    setProgress(100);
    setChapterProgress(sourceId, activeChapter.url, 100);
    onSaveProgress?.(manga, activeChapter, finalProgress, { completed: true });
    pushToast({ type: "success", message: t("media.chapterDone") });
  }, [activeChapter, manga, onSaveProgress, pushToast, sourceId, t]);

  const handleDownloadChapter = useCallback(() => {
    const novel = expectsNovel || data?.kind === "novel";
    if (!novel || chapterDownloading) return;
    if (isChapterOfflineStatus(novelDownloads.rawDownloads, sourceId, manga.url, activeChapter.url)) {
      pushToast({ type: "info", message: t("downloads.novel.confirmAlreadySaved") });
      return;
    }
    const estimate = estimateNovelDownloadBatch(
      sourceId,
      [activeChapter],
      { ...manga, sourceId, url: manga.url },
      novelDownloads.rawDownloads,
    );
    if (estimate.pendingCount === 0) {
      pushToast({ type: "info", message: t("downloads.novel.confirmAlreadySaved") });
      return;
    }
    setDownloadConfirm(estimate);
  }, [
    activeChapter,
    chapterDownloading,
    data?.kind,
    expectsNovel,
    manga,
    novelDownloads.rawDownloads,
    pushToast,
    sourceId,
    t,
  ]);

  const executeConfirmedDownload = useCallback(async () => {
    setDownloadConfirm(null);
    setChapterDownloading(true);
    try {
      await novelDownloads.downloadChapter(
        { ...manga, sourceId, url: manga.url },
        activeChapter,
      );
      pushToast({ type: "success", message: t("downloads.novel.chapterSaved") });
    } catch {
      pushToast({ type: "error", message: t("downloads.novel.failed") });
    } finally {
      setChapterDownloading(false);
    }
  }, [activeChapter, manga, novelDownloads, pushToast, sourceId, t]);

  useReaderPagePreload({
    enabled: readerSettings.preload !== false && data?.kind !== "novel",
    wifiOnly: readerSettings.wifi !== false,
    preloadCount: readerSettings.preloadPages ?? DEFAULT_APP_SETTINGS.preloadPages,
    sourceId,
    pages: data?.pages || [],
    chapterUrl: activeChapter.url,
    containerRef: pagesContainerRef,
  });

  const { completedRef } = useChapterCompletion({
    enabled: Boolean(data),
    scrollProgress: progress,
    progressKey,
    onComplete: handleChapterComplete,
    rootSelector: ".live-reader .chapter-end",
  });

  useEffect(() => {
    let active = true;
    setChaptersLoading(true);
    fetchSourceDetails(sourceId, manga.url, manga).then((details) => {
      if (active && details.chapters?.length) {
        setChapters(normalizeRealmChapterList(sourceId, normalizeChapterList(details.chapters)));
      }
    }).catch(() => {}).finally(() => {
      if (active) setChaptersLoading(false);
    });
    return () => { active = false; };
  }, [manga.url, sourceId]);

  useEffect(() => {
    let active = true;
    const { data: cached, opts: chapterOpts } = resolveReaderChapterCache(sourceId, activeChapter, {
      prefetchData: activeChapter.url === chapter.url ? prefetchData : null,
      manga,
    });
    const saved = getChapterProgress(sourceId, activeChapter.url);
    const normalizedSaved = Math.min(100, Math.max(0, Number(saved) || 0));
    if (cached) {
      setData(cached);
      setLoadingChapter(false);
    } else if (!expectsNovel) {
      setData(null);
      setLoadingChapter(true);
    } else {
      setLoadingChapter(true);
    }
    setError("");
    setProgress(normalizedSaved);
    if (normalizedSaved > 0 && normalizedSaved < 100) {
      pendingSeekRef.current = normalizedSaved;
    } else {
      pendingSeekRef.current = null;
      scrollReaderTo(0);
    }
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("panel");
    setHeaderChromeVisible(true);
    readerChromeHiddenRef.current = false;

    void (async () => {
      let offlineData = null;
      if (!cached && expectsNovel) {
        offlineData = await getOfflineChapterByRefs(sourceId, activeChapter, manga);
        if (!active) return;
        if (offlineData) {
          setData(offlineData);
          setLoadingChapter(false);
        }
      }

      fetchSourceChapter(sourceId, activeChapter.url, chapterOpts)
        .then((result) => {
          if (!active) return;
          setData(result);
          if (normalizedSaved > 0 && normalizedSaved < 100) {
            pendingSeekRef.current = normalizedSaved;
          }
        })
        .catch(async (reason) => {
          if (!active) return;
          if (cached || offlineData) return;
          const offline = expectsNovel
            ? await getOfflineChapterByRefs(sourceId, activeChapter, manga)
            : null;
          if (!active) return;
          if (offline) {
            setData(offline);
            return;
          }
          const message = formatSourceError(reason, t("reader.loadChapterFailed"));
          setError(message);
          if (!expectsNovel) setData(null);
          pushToast({ type: "error", message });
        })
        .finally(() => {
          if (active) setLoadingChapter(false);
        });
    })();

    return () => { active = false; };
  }, [activeChapter.url, activeChapter.contentApi, chapter.url, expectsNovel, manga, prefetchData, progressKey, sourceId, pushToast, t]);

  useEffect(() => {
    const updateProgress = () => {
      if (restoringRef.current) return;
      setProgress(computeReaderScrollProgress());
    };
    const removeScrollListener = addReaderScrollListener(updateProgress);
    window.addEventListener("resize", updateProgress);
    updateProgress();
    return () => {
      removeScrollListener();
      window.removeEventListener("resize", updateProgress);
    };
  }, [activeChapter.url, data?.kind]);

  useEffect(() => {
    if (!data || data.kind === "video") return undefined;
    if (data.kind === "novel" && data.paragraphs?.length) {
      restorePendingScroll();
      return undefined;
    }
    return undefined;
  }, [data?.kind, data?.paragraphs?.length, activeChapter.url, restorePendingScroll]);

  useEffect(() => {
    if (restoringRef.current) return undefined;
    const timer = setTimeout(() => {
      if (restoringRef.current) return;
      setChapterProgress(sourceId, activeChapter.url, progress);
      if (onSaveProgress && progress > 0 && !completedRef.current) {
        onSaveProgress(manga, activeChapter, progress, { completed: false });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [activeChapter, manga, onSaveProgress, progress, sourceId]);

  useEffect(() => () => {
    if (restoringRef.current) return;
    const latest = computeReaderScrollProgress();
    if (latest > 0) {
      setChapterProgress(sourceId, activeChapter.url, latest);
    }
  }, [activeChapter.url, sourceId]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  useEffect(() => {
    if (data?.kind !== "novel" && settingsOpen) setSettingsOpen(false);
  }, [data?.kind, settingsOpen]);

  useEffect(() => {
    if (!autoScroll || !data || touchPaused) return undefined;
    const timer = setInterval(() => {
      const maximum = getMaxScrollTop();
      if (getScrollTop() >= maximum - 3) {
        setAutoScroll(false);
        showReaderChrome();
      } else {
        scrollReaderBy(1.35 * scrollSpeeds[speedIndex]);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [autoScroll, data, showReaderChrome, speedIndex, touchPaused]);

  useEffect(() => {
    if (!data || data.kind === "video" || settingsOpen) return undefined;

    let lastScrollTop = getScrollTop();
    let ticking = false;

    const hideChromeOnScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        // Ne pas masquer le launcher pendant l’auto-scroll (sinon on ne peut plus l’arrêter).
        if (autoScroll) {
          lastScrollTop = getScrollTop();
          return;
        }
        const scrollTop = getScrollTop();
        const delta = scrollTop - lastScrollTop;
        const scrollDelta = 12;
        const next = resolveBottomNavScrollHidden({
          scrollTop,
          lastScrollTop,
          currentlyHidden: readerChromeHiddenRef.current,
          scrollDelta,
        });
        lastScrollTop = next.lastScrollTop;

        if (!next.hidden) {
          readerChromeHiddenRef.current = false;
          setHeaderChromeVisible(true);
          setControlsMode((current) => (current === "hidden" ? "panel" : current));
          return;
        }

        if (delta > scrollDelta && scrollTop > 56) {
          hideReaderChrome();
        }
      });
    };

    return addReaderScrollListener(hideChromeOnScroll);
  }, [autoScroll, data, hideReaderChrome, settingsOpen]);

  useEffect(() => {
    if (settingsOpen || chapterListOpen) return undefined;
    const isReaderControl = (target) => target.closest?.("button, a, .reader-playback, .reader-playback-reopen, .reader-settings, .reader-settings-backdrop, .reader-header, .reader-episode-header, .reader-episode-toolbar, .reader-chapter-list");
    const revealChromeOnTap = () => {
      if (autoScroll) {
        readerChromeHiddenRef.current = false;
        setHeaderChromeVisible(false);
        setControlsMode("panel");
        return;
      }
      showReaderChrome();
    };
    const pauseOnTouch = (event) => {
      if (isReaderControl(event.target)) return;
      if (autoScroll) setTouchPaused(true);
    };
    const resumeAfterTouch = () => {
      if (!autoScroll) return;
      setTouchPaused(false);
    };
    const handleTap = (event) => {
      if (isReaderControl(event.target)) return;
      revealChromeOnTap();
    };
    const stopOnWheel = () => {
      setAutoScroll(false);
      setTouchPaused(false);
      hideReaderChrome();
    };
    window.addEventListener("touchstart", pauseOnTouch, { passive: true });
    window.addEventListener("touchend", resumeAfterTouch, { passive: true });
    window.addEventListener("touchcancel", resumeAfterTouch, { passive: true });
    window.addEventListener("click", handleTap);
    window.addEventListener("wheel", stopOnWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", pauseOnTouch);
      window.removeEventListener("touchend", resumeAfterTouch);
      window.removeEventListener("touchcancel", resumeAfterTouch);
      window.removeEventListener("click", handleTap);
      window.removeEventListener("wheel", stopOnWheel);
    };
  }, [autoScroll, chapterListOpen, hideReaderChrome, settingsOpen, showReaderChrome]);

  useEffect(() => {
    if (!autoScroll) setTouchPaused(false);
  }, [autoScroll]);

  const currentIndex = useMemo(() => chapters.findIndex((entry) => entry.url === activeChapter.url || (entry.number && String(entry.number) === String(activeChapter.number))), [activeChapter, chapters]);
  const previousChapter = useMemo(() => {
    if (currentIndex < 0) return null;
    for (let index = currentIndex + 1; index < chapters.length; index += 1) {
      if (!chapters[index]?.locked) return chapters[index];
    }
    return null;
  }, [chapters, currentIndex]);
  const nextChapter = useMemo(() => {
    if (currentIndex <= 0) return null;
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (!chapters[index]?.locked) return chapters[index];
    }
    return null;
  }, [chapters, currentIndex]);

  useEffect(() => {
    if (!data || loadingChapter || data.kind === "video") return;
    [previousChapter, nextChapter].forEach((neighbor) => {
      if (neighbor) prefetchReaderChapter(sourceId, neighbor, manga);
    });
  }, [data, loadingChapter, manga, nextChapter, previousChapter, sourceId]);

  const speed = scrollSpeeds[speedIndex];

  function seekTo(value, { smooth = false } = {}) {
    const nextProgress = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
    const maximum = getMaxScrollTop();
    setProgress(nextProgress);
    restoringRef.current = true;
    scrollReaderTo(maximum * (nextProgress / 100), { behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => {
      restoringRef.current = false;
      setProgress(computeReaderScrollProgress());
    }, smooth ? 350 : 60);
  }

  function changeChapter(nextChapterToOpen) {
    if (!nextChapterToOpen || nextChapterToOpen.locked) return;
    setActiveChapter(nextChapterToOpen);
  }

  function toggleAutoScroll() {
    if (autoScroll) {
      setAutoScroll(false);
      showReaderChrome();
      return;
    }
    setTouchPaused(false);
    setAutoScroll(true);
    readerChromeHiddenRef.current = true;
    setHeaderChromeVisible(false);
    setControlsMode("panel");
  }

  function closeControls() {
    setControlsMode("hidden");
  }

  function openSettings() {
    setAutoScroll(false);
    setTouchPaused(false);
    setChapterListOpen(false);
    setControlsMode("hidden");
    setHeaderChromeVisible(true);
    setNativeImmersive(false).catch(() => {});
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setHeaderChromeVisible(true);
    setControlsMode("panel");
  }

  function openChapterList() {
    setAutoScroll(false);
    setTouchPaused(false);
    setSettingsOpen(false);
    setControlsMode("hidden");
    setHeaderChromeVisible(true);
    setNativeImmersive(false).catch(() => {});
    setChapterListOpen(true);
  }

  function closeChapterList() {
    setChapterListOpen(false);
    setHeaderChromeVisible(true);
    setControlsMode("panel");
  }

  function selectChapterFromList(chapter) {
    if (!chapter || chapter.locked) return;
    setChapterListOpen(false);
    setHeaderChromeVisible(true);
    setControlsMode("panel");
    changeChapter(chapter);
  }

  const playback = useMemo(() => resolveVideoPlayback(data), [data]);
  const embedPlayback = playback?.mode === "embed";
  const useImmersiveChrome = data?.kind !== "video";

  useEffect(() => {
    if (!embedPlayback) return undefined;
    return installEmbedPopupGuards();
  }, [embedPlayback]);
  const isNovel = expectsNovel || data?.kind === "novel";
  const chapterDownloaded = isNovel && isChapterOfflineStatus(
    novelDownloads.rawDownloads,
    sourceId,
    manga.url,
    activeChapter.url,
  );
  const showChapterLoading = !error && !data;
  const showNovelRefresh = isNovel && loadingChapter && Boolean(data) && !error;
  const contentDir = useMemo(() => {
    if (!isNovel) return dir;
    return resolveNovelContentDirection({
      contentLanguage: data?.contentLanguage,
      languages: profile?.languages,
      paragraphs: data?.paragraphs,
      fallback: dir,
    });
  }, [data?.contentLanguage, data?.paragraphs, dir, isNovel, profile?.languages]);
  const readerStyle = isNovel
    ? {
        "--reader-font-size": `${readerPreferences.fontSize}px`,
        "--reader-line-height": readerPreferences.lineHeight,
        "--reader-paragraph-spacing": `${readerPreferences.paragraphSpacing}em`,
      }
    : undefined;
  const readerClassName = [
    "reader",
    "live-reader",
    isNovel ? "live-reader--novel" : "",
    data?.kind === "video" ? "live-reader--video" : "",
    showChapterLoading ? "live-reader--loading" : "",
    autoScroll ? "live-reader--auto-scroll" : "",
    useImmersiveChrome ? "live-reader--immersive has-episode-header has-episode-toolbar" : "",
    !headerChromeVisible && !settingsOpen && !chapterListOpen ? "live-reader--chrome-hidden" : "",
    settingsOpen || chapterListOpen ? "live-reader--reader-sheet-open" : "",
    isNovel ? `reader--theme-${readerPreferences.theme}` : "",
    isNovel ? `reader--font-${readerPreferences.fontFamily}` : "",
    isNovel ? `reader--align-${readerPreferences.textAlign}` : "",
    isNovel ? `reader--width-${readerPreferences.contentWidth}` : "",
    isNovel ? `reader--content-${contentDir}` : "",
  ].filter(Boolean).join(" ");

  const presentation = useMemo(
    () => getMediaPresentation(isNovel ? "novel" : "manga"),
    [isNovel],
  );

  const reloadChapter = useCallback(async () => {
    const chapterOpts = {
      contentApi: activeChapter.contentApi,
      seriesUrl: sourceId === "novelsparadise" ? manga.url : "",
    };
    await runAppPullRefresh();
    scrollReaderTo(0);
    setError("");
    setLoadingChapter(true);
    try {
      const result = await fetchSourceChapter(sourceId, activeChapter.url, chapterOpts);
      setData(result);
    } catch (reason) {
      const message = formatSourceError(reason, t("reader.loadChapterFailed"));
      setError(message);
      pushToast({ type: "error", message });
    } finally {
      setLoadingChapter(false);
    }
  }, [activeChapter.contentApi, activeChapter.url, manga.url, pushToast, sourceId, t]);

  const readerPullRefreshEnabled = isNativeMobileApp()
    && useImmersiveChrome
    && !settingsOpen
    && !chapterListOpen
    && !autoScroll
    && data?.kind !== "video";

  const {
    pullDistance: readerPullDistance,
    refreshing: readerRefreshing,
    threshold: readerPullThreshold,
  } = usePullToRefresh({
    scrollerRef: readerBodyRef,
    onRefresh: reloadChapter,
    enabled: readerPullRefreshEnabled,
  });

  const readerPlaybackProps = {
    progress,
    onSeek: seekTo,
    autoScroll,
    onToggleAutoScroll: toggleAutoScroll,
    speed,
    onCycleSpeed: () => setSpeedIndex((index) => (index + 1) % scrollSpeeds.length),
    previousChapter,
    nextChapter,
    activeChapter,
    chaptersLoading,
    chapterCount: chapters.length,
    onPrevious: () => changeChapter(previousChapter),
    onNext: () => changeChapter(nextChapter),
    onOpenChapterList: openChapterList,
    onOpenSettings: openSettings,
    showSettings: isNovel,
    settingsOpen,
    onClose: closeControls,
    unitLabel: presentation.headerUnit,
  };

  return (
    <div className={readerClassName} style={readerStyle} dir={dir}>
      {readerPullRefreshEnabled ? (
        <PullToRefreshIndicator
          pullDistance={readerPullDistance}
          refreshing={readerRefreshing}
          threshold={readerPullThreshold}
        />
      ) : null}
      {useImmersiveChrome ? (
        <ReaderEpisodeHeader
          chapter={activeChapter}
          unitLabel={presentation.headerUnit}
          seriesTitle={manga.title}
          chapterUrl={activeChapter.url}
          isFavorite={isFavorite}
          chromeHidden={!settingsOpen && (autoScroll || !headerChromeVisible)}
          onBack={onBack}
          onOpenDetails={onOpenDetails}
          onToggleFavorite={onToggleFavorite}
          onDownload={isNovel ? handleDownloadChapter : undefined}
          chapterDownloaded={chapterDownloaded}
          chapterDownloading={chapterDownloading}
        />
      ) : (
        <ReaderHeader
          title={manga.title}
          cover={manga.cover}
          chapterName={activeChapter.name}
          sourceId={sourceId}
          sourceName={profile.name}
          progress={progress}
          chapterUrl={activeChapter.url}
          isFavorite={isFavorite}
          settingsOpen={settingsOpen}
          chromeHidden={!settingsOpen && (autoScroll || !headerChromeVisible)}
          onBack={onBack}
          onOpenDetails={onOpenDetails}
          onOpenSettings={openSettings}
          onToggleFavorite={onToggleFavorite}
          unitLabel={data?.kind === "video" ? t("media.theEpisode") : t("media.theChapter")}
          hideSettings={!isNovel}
        />
      )}
      <div className="live-reader__body" ref={readerBodyRef}>
      {error ? <div className="reader-live-state"><Wifi size={30} /><h2>{t("reader.loadChapterFailed")}</h2><p>{error}</p></div> : showChapterLoading ? (
        isNovel
          ? <NovelReaderSkeleton label={t("reader.loadingChapter")} />
          : <ReaderPagesSkeleton label={t("reader.loadingChapter")} />
      ) : data.kind === "video" ? (
        <div className="live-video-stage">
          {!playback ? (
            <div className="reader-live-state live-video-state">
              <BookOpen size={30} />
              <h2>{t("reader.videoUnavailable")}</h2>
              <button type="button" className="primary-button" onClick={() => window.open(activeChapter.url, "_blank", "noopener,noreferrer")}>
                {t("reader.openOnSource", { source: profile.name })}
              </button>
            </div>
          ) : playback.mode === "embed" ? (
            <div className="live-video-embed">
              <EmbedPlayerFrame
                src={playback.url}
                title={data.title || activeChapter.name}
              />
            </div>
          ) : (
            <video className="live-video-player" src={playback.url} controls playsInline preload="metadata" />
          )}
        </div>
      ) : data.kind === "novel" ? (
        <article className={`novel-reader-content${showNovelRefresh ? " novel-reader-content--loading" : ""}`} dir={contentDir} aria-busy={showNovelRefresh}>
          {showNovelRefresh && (
            <div className="novel-reader-content__refresh" role="status" aria-live="polite">
              <span className="novel-reader-content__refresh-bar" aria-hidden="true" />
              <span className="novel-reader-content__refresh-label">{t("reader.loadingChapter")}</span>
            </div>
          )}
          {data.paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
          ))}
          {!data.paragraphs.length && (
            <div className="reader-live-state">
              <BookOpen size={30} />
              <h2>{data.locked ? t("reader.paidChapter") : t("reader.textUnavailable")}</h2>
              {data.paywallMessage ? <p>{data.paywallMessage}</p> : null}
              {data.locked ? (
                isAzoraFlySource(sourceId) ? (
                  <UnlockCountdown unlockAt={data.unlockAt || activeChapter.unlockAt} />
                ) : (
                <button type="button" className="primary-button" onClick={() => window.open(activeChapter.url, "_blank", "noopener,noreferrer")}>
                  {t("reader.openOnSource", { source: profile.name })}
                </button>
                )
              ) : null}
            </div>
          )}
          <div className="chapter-end">
            <Check size={25} />
            <h2>{t("media.endChapter")} {activeChapter.name}</h2>
          </div>
        </article>
      ) : <div className="live-reader-pages" ref={pagesContainerRef}><ReaderPageList sourceId={sourceId} pages={data.pages} onFirstPageReady={restorePendingScroll} />{!data.pages.length && <div className="reader-live-state"><BookOpen size={30} /><h2>{data.locked ? t("reader.paidChapter") : t("reader.noChapterImages")}</h2>{data.paywallMessage ? <p>{data.paywallMessage}</p> : null}{data.locked ? (isAzoraFlySource(sourceId) ? <UnlockCountdown unlockAt={data.unlockAt || activeChapter.unlockAt} /> : <button type="button" className="primary-button" onClick={() => window.open(activeChapter.url, "_blank", "noopener,noreferrer")}>{t("reader.openOnSource", { source: profile.name })}</button>) : null}</div>}<div className="chapter-end"><Check size={25} /><h2>{t("media.endChapter")} {activeChapter.name}</h2></div></div>}
      </div>
      {useImmersiveChrome && data?.kind !== "video" && !settingsOpen && !chapterListOpen ? (
        <ReaderEpisodeToolbar
          visible={controlsMode === "panel" || autoScroll}
          controlsProps={readerPlaybackProps}
        />
      ) : data?.kind !== "video" && !settingsOpen && !chapterListOpen ? (
        <div className={`live-reader__dock${controlsMode === "hidden" && !autoScroll ? " live-reader__dock--hidden" : ""}`}>
          {(controlsMode === "panel" || autoScroll) ? (
            <ReaderPlaybackControls {...readerPlaybackProps} />
          ) : null}
        </div>
      ) : null}
      {settingsOpen && isNovel && <ReaderSettingsSheet preferences={readerPreferences} onChange={setReaderPreferences} onClose={closeSettings} onReset={() => setReaderPreferences(defaultReaderPreferences)} />}
      {chapterListOpen && (
        <ReaderChapterListSheet
          manga={manga}
          chapters={chapters}
          activeChapter={activeChapter}
          sourceId={sourceId}
          loading={chaptersLoading}
          theme={isNovel ? readerPreferences.theme : "night"}
          onSelect={selectChapterFromList}
          onClose={closeChapterList}
        />
      )}
      <NovelDownloadConfirmDialog
        open={Boolean(downloadConfirm)}
        mode="chapter"
        estimate={downloadConfirm}
        onConfirm={executeConfirmedDownload}
        onCancel={() => setDownloadConfirm(null)}
      />
    </div>
  );
}
