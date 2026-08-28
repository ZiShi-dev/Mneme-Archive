import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { allowsHeavyNetworkUse } from "../lib/platform/dataSaver";
import { refreshNetworkStatus } from "../lib/platform/networkStatus";
import {
  initNativeNotifications,
  registerNotificationOpenHandler,
  showChapterUpdateNotifications,
} from "../lib/notifications/nativeNotifications";
import { t } from "../i18n/runtime.js";

const DEFAULT_POLL_MINUTES = 1;
const MIN_POLL_MS = 60_000;

export function useRealtimeFollowSync({
  chapterFollow,
  settings,
  pushToast,
  onNotificationOpen,
}) {
  const syncLockRef = useRef(false);
  const appActiveRef = useRef(true);
  const syncFollowedRef = useRef(chapterFollow.syncFollowed);
  const followedCountRef = useRef(chapterFollow.followedCount);
  const pushToastRef = useRef(pushToast);
  const onNotificationOpenRef = useRef(onNotificationOpen);
  const settingsRef = useRef(settings);

  syncFollowedRef.current = chapterFollow.syncFollowed;
  followedCountRef.current = chapterFollow.followedCount;
  pushToastRef.current = pushToast;
  onNotificationOpenRef.current = onNotificationOpen;
  settingsRef.current = settings;

  useEffect(() => {
    if (!settings?.notifications) return undefined;

    let disposed = false;
    let intervalId = null;
    let removeNotificationHandler = () => {};

    async function runBackgroundSync(reason = "background") {
      if (!followedCountRef.current || syncLockRef.current) return { events: [], errors: [] };

      await refreshNetworkStatus();
      if (!allowsHeavyNetworkUse(settingsRef.current)) {
        return { events: [], errors: [], skipped: true, reason: "metered" };
      }

      syncLockRef.current = true;
      try {
        const result = await syncFollowedRef.current({ silent: true });
        const events = result.events || [];

        if (events.length) {
          await showChapterUpdateNotifications(events);

          if (appActiveRef.current) {
            pushToastRef.current({
              type: "info",
              message: t("toast.nNewInUpdates", { count: events.length }),
            });
          }
        }

        return { ...result, reason };
      } finally {
        syncLockRef.current = false;
      }
    }

    async function bootstrap() {
      if (Capacitor.isNativePlatform()) {
        await initNativeNotifications();
      }

      if (disposed) return;

      removeNotificationHandler = registerNotificationOpenHandler((extra) => {
        onNotificationOpenRef.current?.(extra);
      });

      await runBackgroundSync("startup");
    }

    bootstrap();

    const pollMinutes = Math.max(1, Number(settings.followPollMinutes) || DEFAULT_POLL_MINUTES);
    intervalId = window.setInterval(() => {
      if (!appActiveRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      runBackgroundSync("interval");
    }, Math.max(MIN_POLL_MS, pollMinutes * 60_000));

    const appStateListener = App.addListener("appStateChange", ({ isActive }) => {
      appActiveRef.current = isActive;
      if (isActive) runBackgroundSync("resume");
    });

    return () => {
      disposed = true;
      if (intervalId) window.clearInterval(intervalId);
      removeNotificationHandler();
      appStateListener.then((handle) => handle.remove());
    };
  }, [settings?.followPollMinutes, settings?.notifications, settings?.wifi]);

  return { runSync: () => syncFollowedRef.current({ silent: true }) };
}
