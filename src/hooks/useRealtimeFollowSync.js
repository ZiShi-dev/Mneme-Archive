import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { allowsFollowSyncNetworkUse } from "../lib/platform/dataSaver";
import { refreshNetworkStatus } from "../lib/platform/networkStatus";
import {
  initSystemNotifications,
  registerNotificationOpenHandler,
} from "../lib/notifications/pushNotifications";
import { shouldRunFollowIntervalPoll } from "../lib/updates/followSyncPollPolicy";
import { t } from "../i18n/runtime.js";
import { isChromebookApp } from "../config/appFlavor";
import { isElectronApp } from "../lib/platform/electronApp.js";

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
      if (!allowsFollowSyncNetworkUse(settingsRef.current)) {
        return { events: [], errors: [], skipped: true, reason: "metered" };
      }

      syncLockRef.current = true;
      try {
        const result = await syncFollowedRef.current({ silent: true });
        const events = result.events || [];

        if (events.length) {
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

    const desktopBackground = isElectronApp();
    const nativePlatform = Capacitor.isNativePlatform();

    async function bootstrap() {
      if (nativePlatform || desktopBackground) {
        try {
          await initSystemNotifications();
        } catch {
          // Notifications optionnelles au démarrage.
        }
      }

      if (disposed) return;

      removeNotificationHandler = registerNotificationOpenHandler((extra) => {
        onNotificationOpenRef.current?.(extra);
      });

      if (isChromebookApp && Capacitor.isNativePlatform()) {
        window.setTimeout(() => {
          if (!disposed) void runBackgroundSync("startup");
        }, 2500);
        return;
      }

      await runBackgroundSync("startup");
    }

    bootstrap();

    const pollMinutes = Math.max(1, Number(settings.followPollMinutes) || DEFAULT_POLL_MINUTES);
    intervalId = window.setInterval(() => {
      if (!shouldRunFollowIntervalPoll({
        isNative: nativePlatform,
        desktopBackground,
        appActive: appActiveRef.current,
        documentHidden: typeof document !== "undefined" && document.hidden,
      })) return;
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
