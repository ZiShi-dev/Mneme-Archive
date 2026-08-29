import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const [activeChapter, setActiveChapter] = useState(chapter);
  const [chapters, setChapters] = useState(manga.recentChapters || [chapter]);
  const [chaptersLoading, setChaptersLoading] = useState(() => !(manga.chapters?.length || manga.recentChapters?.length > 1));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [controlsMode, setControlsMode] = useState("panel");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerPreferences, setReaderPreferences] = usePersistedState(readerPreferencesKey, defaultReaderPreferences);
  const launcherTimer = useRef(null);
  const manualScrollTimer = useRef(null);
  const pagesContainerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const progressKey = `living-archive:chapter-progress:${sourceId}:${activeChapter.url}`;

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
    setData(null);
    setError("");
    const saved = getChapterProgress(sourceId, activeChapter.url);
    setProgress(saved > 0 && saved < 100 ? saved : 0);
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("panel");
    window.scrollTo(0, 0);
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
        pushToast({ type: "error", message });
      });
    return () => { active = false; };
  }, [activeChapter.url, progressKey, sourceId, pushToast, t]);

  useEffect(() => {
    const updateProgress = () => {
      setProgress(computeReaderScrollProgress());
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
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

  useEffect(() => {
    if (!autoScroll || !data || touchPaused) return undefined;
    const timer = setInterval(() => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= maximum - 3) {
        setAutoScroll(false);
        setControlsMode("panel");
      }
      else window.scrollBy(0, 1.35 * scrollSpeeds[speedIndex]);
    }, 16);
    return () => clearInterval(timer);
  }, [autoScroll, data, speedIndex, touchPaused]);

  useEffect(() => {
    const isReaderControl = (target) => target.closest?.("button, a, .reader-playback, .reader-playback-reopen, .reader-settings, .reader-settings-backdrop");
    const revealLauncherTemporarily = () => {
      window.clearTimeout(launcherTimer.current);
      setControlsMode("launcher");
      launcherTimer.current = window.setTimeout(() => setControlsMode("hidden"), 3000);
    };
    const revealLauncherAfterManualScroll = () => {
      window.clearTimeout(manualScrollTimer.current);
      setControlsMode("hidden");
      manualScrollTimer.current = window.setTimeout(() => setControlsMode("launcher"), 550);
    };
    const pauseOnTouch = (event) => {
      if (isReaderControl(event.target)) return;
      if (autoScroll) setTouchPaused(true);
    };
    const handleTouchMove = (event) => {
      if (isReaderControl(event.target)) return;
      if (!autoScroll) revealLauncherAfterManualScroll();
    };
    const resumeAfterTouch = () => {
      if (!autoScroll) return;
      setTouchPaused(false);
      revealLauncherTemporarily();
    };
    const showLauncherOnClick = (event) => {
      if (!autoScroll || isReaderControl(event.target)) return;
      revealLauncherTemporarily();
    };
    const stopOnWheel = () => {
      setAutoScroll(false);
      setTouchPaused(false);
      revealLauncherAfterManualScroll();
    };
    window.addEventListener("touchstart", pauseOnTouch, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", resumeAfterTouch, { passive: true });
    window.addEventListener("touchcancel", resumeAfterTouch, { passive: true });
    window.addEventListener("click", showLauncherOnClick);
    window.addEventListener("wheel", stopOnWheel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", pauseOnTouch);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", resumeAfterTouch);
      window.removeEventListener("touchcancel", resumeAfterTouch);
      window.removeEventListener("click", showLauncherOnClick);
      window.removeEventListener("wheel", stopOnWheel);
    };
  }, [autoScroll]);

  useEffect(() => () => {
    window.clearTimeout(launcherTimer.current);
    window.clearTimeout(manualScrollTimer.current);
  }, []);

  useEffect(() => {
    if (!autoScroll) setTouchPaused(false);
  }, [autoScroll]);

  const currentIndex = useMemo(() => chapters.findIndex((entry) => entry.url === activeChapter.url || (entry.number && String(entry.number) === String(activeChapter.number))), [activeChapter, chapters]);
  const previousChapter = currentIndex >= 0 ? chapters[currentIndex + 1] : null;
  const nextChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const speed = scrollSpeeds[speedIndex];

  function seekTo(value) {
    const nextProgress = Math.round(Number(value));
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(nextProgress);
    window.scrollTo({ top: maximum * (nextProgress / 100), behavior: "smooth" });
  }

  function changeChapter(nextChapterToOpen) {
    if (!nextChapterToOpen) return;
    setActiveChapter(nextChapterToOpen);
  }

  function toggleAutoScroll() {
    window.clearTimeout(launcherTimer.current);
    if (autoScroll) {
      setAutoScroll(false);
      setControlsMode("panel");
      return;
    }
    setTouchPaused(false);
    setAutoScroll(true);
    setControlsMode("hidden");
  }

  function openControls() {
    window.clearTimeout(launcherTimer.current);
    window.clearTimeout(manualScrollTimer.current);
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("panel");
  }

  function closeControls() {
    setControlsMode("launcher");
  }

  function openSettings() {
    window.clearTimeout(launcherTimer.current);
    window.clearTimeout(manualScrollTimer.current);
    setAutoScroll(false);
    setTouchPaused(false);
    setControlsMode("hidden");
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setControlsMode("launcher");
  }

  const playback = useMemo(() => resolveVideoPlayback(data), [data]);
  const embedPlayback = playback?.mode === "embed";

  useEffect(() => {
    if (!embedPlayback || !Capacitor.isNativePlatform()) return undefined;
    return installEmbedPopupGuards();
  }, [embedPlayback]);
  const isNovel = data?.kind === "novel";
  const contentDir = useMemo(() => {
    if (!isNovel) return dir;
    return resolveNovelContentDirection({
      contentLanguage: data?.contentLanguage,
      languages: profile?.languages,
      fallback: dir,
    });
  }, [data?.contentLanguage, dir, isNovel, profile?.languages]);
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
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        onOpenSettings={openSettings}
        onToggleFavorite={onToggleFavorite}
        unitLabel={data?.kind === "video" ? t("media.theEpisode") : t("media.theChapter")}
        hideSettings={!isNovel}
      />
      {error ? <div className="reader-live-state"><Wifi size={30} /><h2>{t("reader.loadChapterFailed")}</h2><p>{error}</p></div> : !data ? (
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
        <article className="novel-reader-content" dir={contentDir}>
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
      {data?.kind !== "video" && !settingsOpen && (controlsMode === "panel" ? <ReaderPlaybackControls progress={progress} onSeek={seekTo} autoScroll={autoScroll} onToggleAutoScroll={toggleAutoScroll} speed={speed} onCycleSpeed={() => setSpeedIndex((index) => (index + 1) % scrollSpeeds.length)} previousChapter={previousChapter} nextChapter={nextChapter} chaptersLoading={chaptersLoading} onPrevious={() => changeChapter(previousChapter)} onNext={() => changeChapter(nextChapter)} onClose={closeControls} /> : controlsMode === "launcher" ? <button className="reader-playback-reopen" onClick={openControls} aria-label={t("reader.playback.showControls")}><Settings2 size={17} /><span>{progress}%</span></button> : null)}
      {settingsOpen && isNovel && <ReaderSettingsSheet preferences={readerPreferences} onChange={setReaderPreferences} onClose={closeSettings} onReset={() => setReaderPreferences(defaultReaderPreferences)} />}
    </div>
  );
}
