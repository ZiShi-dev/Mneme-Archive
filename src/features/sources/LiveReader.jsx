import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, BookOpen, Check, Settings2, Wifi } from "lucide-react";
import { useToast } from "../../components/ui/ToastProvider";
import { getSourceProfile, resolveSourceId } from "../../config/sources";
import { useChapterCompletion } from "../../hooks/useChapterCompletion";
import {
  computeReaderScrollProgress,
  getChapterScrollKey,
} from "../../lib/readingProgress";
import { getChapterProgress, setChapterProgress } from "../../lib/storage/chapterProgress";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useReaderPagePreload } from "../../hooks/useReaderPagePreload";
import { DEFAULT_APP_SETTINGS } from "../../lib/settings/defaults";
import { fetchSourceChapter, fetchSourceDetails, formatSourceError } from "./sourceApi";
import { normalizeChapterList } from "../../../server/lib/chapterOrdering.js";
import { resolveBookmarkType } from "./contentTypes";
import { resolveVideoPlayback } from "./mediaPresentation";
import { ReaderPageList } from "./ReaderPageList";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderPlaybackControls } from "./ReaderPlaybackControls";
import { ReaderSettingsSheet } from "./ReaderSettingsSheet";
import { EmbedPlayerFrame } from "./EmbedPlayerFrame";
import { SourceLogo } from "./SourceLogo";
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

const scrollSpeeds = [0.5, 1, 1.5, 2];
const defaultReaderPreferences = { theme: "night", fontSize: 18, lineHeight: 1.9, fontFamily: "naskh", textAlign: "right", paragraphSpacing: 1.25, contentWidth: "normal" };
const readerPreferencesKey = "living-archive:reader-preferences";

export function LiveReader({
  manga,
  chapter,
  onBack,
  onOpenDetails,
  isFavorite,
  onToggleFavorite,
  onSaveProgress,
  readerSettings = DEFAULT_APP_SETTINGS,
}) {
  const { pushToast } = useToast();
  const { t, dir } = useI18n();
  const sourceId = resolveSourceId(manga);
  const profile = getSourceProfile(sourceId);
  const expectsNovel = useMemo(() => resolveBookmarkType(manga) === "novel", [manga]);
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(manga.recentChapters || [chapter]);
  const [chaptersLoading, setChaptersLoading] = useState(() => !(manga.chapters?.length || manga.recentChapters?.length > 1));
  const [data, setData] = useState(null);
  const [loadingChapter, setLoadingChapter] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [controlsMode, setControlsMode] = useState("panel");
  const [headerChromeVisible, setHeaderChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerPreferences, setReaderPreferences] = usePersistedState(readerPreferencesKey, defaultReaderPreferences);
  const readerChromeHiddenRef = useRef(false);
  const pagesContainerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const progressKey = `living-archive:chapter-progress:${sourceId}:${activeChapter.url}`;

  const hideReaderChrome = useCallback(() => {
    readerChromeHiddenRef.current = true;
    setHeaderChromeVisible(false);
    setControlsMode("hidden");
  }, []);

  const showReaderChrome = useCallback((mode = "launcher") => {
    readerChromeHiddenRef.current = false;
    setHeaderChromeVisible(true);
    setControlsMode(mode);
  }, []);

  const handleChapterComplete = useCallback(() => {
    const finalProgress = Math.max(computeReaderScrollProgress(), 100);
    setProgress(100);
    setChapterProgress(sourceId, activeChapter.url, 100);
    onSaveProgress?.(manga, activeChapter, finalProgress, { completed: true });
    pushToast({ type: "success", message: t("media.chapterDone") });
  }, [activeChapter, manga, onSaveProgress, pushToast, sourceId, t]);

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
    fetchSourceDetails(sourceId, manga.url).then((details) => {
      if (active && details.chapters?.length) {
        setChapters(normalizeChapterList(details.chapters));
      }
    }).catch(() => {}).finally(() => {
      if (active) setChaptersLoading(false);
    });
    return () => { active = false; };
  }, [manga.url, sourceId]);

  useEffect(() => {
    let active = true;
    setLoadingChapter(true);
    setError("");
    if (!expectsNovel) setData(null);
    const saved = getChapterProgress(sourceId, activeChapter.url);
    setProgress(saved > 0 && saved < 100 ? saved : 0);
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("panel");
    setHeaderChromeVisible(true);
    readerChromeHiddenRef.current = false;
    scrollReaderTo(0);
    pendingSeekRef.current = null;
    fetchSourceChapter(sourceId, activeChapter.url, {
      contentApi: activeChapter.contentApi,
      seriesUrl: sourceId === "novelsparadise" ? manga.url : "",
    })
      .then((result) => {
        if (!active) return;
        setData(result);
        if (saved > 1 && saved < 100 && result?.pages?.length) {
          pendingSeekRef.current = saved;
        }
      })
      .catch((reason) => {
        if (!active) return;
        const message = formatSourceError(reason, t("reader.loadChapterFailed"));
        setError(message);
        if (!expectsNovel) setData(null);
        pushToast({ type: "error", message });
      })
      .finally(() => {
        if (active) setLoadingChapter(false);
      });
    return () => { active = false; };
  }, [activeChapter.url, activeChapter.contentApi, expectsNovel, manga.url, progressKey, sourceId, pushToast, t]);

  useEffect(() => {
    const updateProgress = () => {
      setProgress(computeReaderScrollProgress());
    };
    const removeScrollListener = addReaderScrollListener(updateProgress);
    window.addEventListener("resize", updateProgress);
    return () => {
      removeScrollListener();
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setChapterProgress(sourceId, activeChapter.url, progress);
      if (onSaveProgress && progress > 0 && !completedRef.current) {
        onSaveProgress(manga, activeChapter, progress, { completed: false });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [activeChapter, manga, onSaveProgress, progress, sourceId]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  useEffect(() => {
    if (data?.kind !== "novel" && settingsOpen) setSettingsOpen(false);
  }, [data?.kind, settingsOpen]);

  useLayoutEffect(() => {
    if (!autoScroll) return;
    hideReaderChrome();
  }, [autoScroll, hideReaderChrome]);

  useEffect(() => {
    if (!autoScroll || controlsMode !== "panel") return;
    hideReaderChrome();
  }, [autoScroll, controlsMode, hideReaderChrome]);

  useEffect(() => {
    if (!autoScroll || !data || touchPaused) return undefined;
    const timer = setInterval(() => {
      const maximum = getMaxScrollTop();
      if (getScrollTop() >= maximum - 3) {
        setAutoScroll(false);
        showReaderChrome("panel");
      } else {
        scrollReaderBy(1.35 * scrollSpeeds[speedIndex]);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [autoScroll, data, hideReaderChrome, showReaderChrome, speedIndex, touchPaused]);

  useEffect(() => {
    if (!data || data.kind === "video" || settingsOpen) return undefined;

    let lastScrollTop = getScrollTop();
    let ticking = false;

    const hideChromeOnScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const scrollTop = getScrollTop();
        const delta = scrollTop - lastScrollTop;
        const scrollDelta = autoScroll ? 4 : 12;
        const next = resolveBottomNavScrollHidden({
          scrollTop,
          lastScrollTop,
          currentlyHidden: readerChromeHiddenRef.current,
          scrollDelta,
        });
        lastScrollTop = next.lastScrollTop;

        if (!next.hidden) {
          if (!autoScroll) {
            readerChromeHiddenRef.current = false;
            setHeaderChromeVisible(true);
            setControlsMode((current) => (current === "hidden" ? "panel" : current));
          }
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
    const isReaderControl = (target) => target.closest?.("button, a, .reader-playback, .reader-playback-reopen, .reader-settings, .reader-settings-backdrop, .reader-header");
    const revealChromeOnTap = () => {
      showReaderChrome("launcher");
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
  }, [autoScroll, hideReaderChrome, settingsOpen, showReaderChrome]);

  useEffect(() => {
    if (!autoScroll) setTouchPaused(false);
  }, [autoScroll]);

  const currentIndex = useMemo(() => chapters.findIndex((entry) => entry.url === activeChapter.url || (entry.number && String(entry.number) === String(activeChapter.number))), [activeChapter, chapters]);
  const previousChapter = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const nextChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const speed = scrollSpeeds[speedIndex];

  function seekTo(value) {
    const nextProgress = Math.round(Number(value));
    const maximum = getMaxScrollTop();
    setProgress(nextProgress);
    scrollReaderTo(maximum * (nextProgress / 100), { behavior: "smooth" });
  }

  function changeChapter(nextChapterToOpen) {
    if (!nextChapterToOpen) return;
    setActiveChapter(nextChapterToOpen);
  }

  function toggleAutoScroll() {
    if (autoScroll) {
      setAutoScroll(false);
      showReaderChrome("panel");
      return;
    }
    setTouchPaused(false);
    setAutoScroll(true);
    hideReaderChrome();
  }

  function openControls() {
    setAutoScroll(false);
    setTouchPaused(false);
    showReaderChrome("panel");
  }

  function closeControls() {
    setControlsMode("launcher");
  }

  function openSettings() {
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("hidden");
    setHeaderChromeVisible(true);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setHeaderChromeVisible(true);
    setControlsMode("launcher");
  }

  const playback = useMemo(() => resolveVideoPlayback(data), [data]);
  const embedPlayback = playback?.mode === "embed";

  useEffect(() => {
    if (!embedPlayback || !Capacitor.isNativePlatform()) return undefined;
    return installEmbedPopupGuards();
  }, [embedPlayback]);
  const isNovel = expectsNovel || data?.kind === "novel";
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
    !headerChromeVisible && !settingsOpen ? "live-reader--chrome-hidden" : "",
    isNovel ? `reader--theme-${readerPreferences.theme}` : "",
    isNovel ? `reader--font-${readerPreferences.fontFamily}` : "",
    isNovel ? `reader--align-${readerPreferences.textAlign}` : "",
    isNovel ? `reader--width-${readerPreferences.contentWidth}` : "",
    isNovel ? `reader--content-${contentDir}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={readerClassName} style={readerStyle} dir={dir}>
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
        chromeHidden={!settingsOpen && (autoScroll ? controlsMode === "hidden" : !headerChromeVisible)}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        onOpenSettings={openSettings}
        onToggleFavorite={onToggleFavorite}
        unitLabel={data?.kind === "video" ? t("media.theEpisode") : t("media.theChapter")}
        hideSettings={!isNovel}
      />
      <div className="live-reader__body">
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
          <div className="novel-reader-content__source">
            <SourceLogo sourceId={sourceId} />
            <span>{t("reader.novelFromSource", { source: profile.name })}</span>
          </div>
          {data.paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
          ))}
          {!data.paragraphs.length && (
            <div className="reader-live-state">
              <BookOpen size={30} />
              <h2>{t("reader.textUnavailable")}</h2>
            </div>
          )}
          <div className="chapter-end">
            <Check size={25} />
            <h2>{t("media.endChapter")} {activeChapter.name}</h2>
          </div>
        </article>
      ) : <div className="live-reader-pages" ref={pagesContainerRef}><ReaderPageList sourceId={sourceId} pages={data.pages} onFirstPageReady={() => { if (pendingSeekRef.current != null) { const saved = pendingSeekRef.current; pendingSeekRef.current = null; window.setTimeout(() => seekTo(saved), 80); } }} />{!data.pages.length && <div className="reader-live-state"><BookOpen size={30} /><h2>{data.locked ? t("reader.paidChapter") : t("reader.noChapterImages")}</h2>{data.paywallMessage ? <p>{data.paywallMessage}</p> : null}{data.locked ? <button type="button" className="primary-button" onClick={() => window.open(activeChapter.url, "_blank", "noopener,noreferrer")}>{t("reader.openOnSource", { source: profile.name })}</button> : null}</div>}<div className="chapter-end"><Check size={25} /><h2>{t("media.endChapter")} {activeChapter.name}</h2></div></div>}
      </div>
      {data?.kind !== "video" && !settingsOpen && (
        <div className={`live-reader__dock${controlsMode === "hidden" ? " live-reader__dock--hidden" : ""}`}>
          {controlsMode === "panel" && !autoScroll ? <ReaderPlaybackControls progress={progress} onSeek={seekTo} autoScroll={autoScroll} onToggleAutoScroll={toggleAutoScroll} speed={speed} onCycleSpeed={() => setSpeedIndex((index) => (index + 1) % scrollSpeeds.length)} previousChapter={previousChapter} nextChapter={nextChapter} chaptersLoading={chaptersLoading} onPrevious={() => changeChapter(previousChapter)} onNext={() => changeChapter(nextChapter)} onClose={closeControls} /> : controlsMode === "launcher" ? <button className="reader-playback-reopen" onClick={openControls} aria-label={t("reader.playback.showControls")}><Settings2 size={17} /><span>{progress}%</span></button> : null}
        </div>
      )}
      {settingsOpen && isNovel && <ReaderSettingsSheet preferences={readerPreferences} onChange={setReaderPreferences} onClose={closeSettings} onReset={() => setReaderPreferences(defaultReaderPreferences)} />}
    </div>
  );
}
