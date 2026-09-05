import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../../config/appFlavor.js";
import { formatFollowNotificationBody } from "../updates/followMessaging.js";
import { isElectronApp, focusElectronApp } from "../platform/electronApp.js";
import {
  getNotificationPermissionStatus as getNativePermissionStatus,
  initNativeNotifications,
  isNativeNotificationsAvailable,
  registerNotificationOpenHandler as registerNativeNotificationOpenHandler,
  requestNotificationPermission as requestNativePermission,
  sendTestNotification as sendNativeTestNotification,
  showChapterUpdateNotifications as showNativeChapterUpdateNotifications,
} from "./nativeNotifications.js";

export { isNativeNotificationsAvailable };

const WEB_ICON = "./pwa/icon-192.png";

let webNotificationOpenHandler = null;

export function isWebNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isSystemNotificationsAvailable() {
  if (isNativeNotificationsAvailable()) return true;
  if (isElectronApp() && isWebNotificationsSupported()) return true;
  if (isWebNotificationsSupported()) return true;
  return isChromebookApp && isWebNotificationsSupported();
}

export async function initSystemNotifications() {
  if (isNativeNotificationsAvailable()) {
    return initNativeNotifications();
  }
  return getNotificationPermissionStatus();
}

export async function getNotificationPermissionStatus() {
  if (isNativeNotificationsAvailable()) {
    return getNativePermissionStatus();
  }
  if (!isWebNotificationsSupported()) {
    return { granted: false, available: false, display: "unsupported" };
  }
  const permission = Notification.permission;
  return {
    granted: permission === "granted",
    available: true,
    display: permission,
  };
}

export async function requestNotificationPermission() {
  if (isNativeNotificationsAvailable()) {
    return requestNativePermission();
  }
  if (!isWebNotificationsSupported()) {
    return { granted: false, available: false, display: "unsupported" };
  }
  const permission = await Notification.requestPermission();
  return {
    granted: permission === "granted",
    available: true,
    display: permission,
  };
}

export async function showChapterUpdateNotifications(events = []) {
  if (!events.length) return 0;

  if (isNativeNotificationsAvailable()) {
    return showNativeChapterUpdateNotifications(events);
  }

  if (!isWebNotificationsSupported()) return 0;

  const permission = await getNotificationPermissionStatus();
  if (!permission.granted) return 0;

  let count = 0;
  for (const event of events) {
    try {
      const notification = new Notification(event.title, {
        body: formatFollowNotificationBody(event),
        icon: WEB_ICON,
        badge: WEB_ICON,
        tag: event.id,
        renotify: true,
        data: {
          url: event.url,
          title: event.title,
          altTitle: event.altTitle || "",
          cover: event.cover || "",
          sourceId: event.sourceId,
          mediaType: event.mediaType || null,
          chapterUrl: event.chapterUrl,
          chapterNumber: event.chapterNumber,
          chapterName: event.chapterName,
          feedId: event.id,
        },
      });
      notification.onclick = () => {
        if (webNotificationOpenHandler && notification.data) {
          webNotificationOpenHandler(notification.data);
        } else if (isElectronApp()) focusElectronApp();
        else window.focus();
        notification.close();
      };
      count += 1;
    } catch {
      // Ignore blocked or unsupported notification payloads.
    }
  }

  return count;
}

export async function sendTestNotification() {
  if (isNativeNotificationsAvailable()) {
    return sendNativeTestNotification();
  }

  if (!isWebNotificationsSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return { ok: false, reason: "denied" };
  }

  try {
    new Notification("CinéVault", {
      body: "Notification test — les alertes d’épisodes fonctionnent.",
      icon: WEB_ICON,
      badge: WEB_ICON,
      tag: "cinevault-test",
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "denied" };
  }
}

export function registerNotificationOpenHandler(handler) {
  if (isNativeNotificationsAvailable()) {
    return registerNativeNotificationOpenHandler(handler);
  }

  if (!isWebNotificationsSupported()) return () => {};

  webNotificationOpenHandler = handler;

  function onMessage(event) {
    const data = event.data?.payload?.data || event.data;
    if (data && typeof data === "object") handler(data);
  }

  navigator.serviceWorker?.addEventListener("message", onMessage);
  return () => {
    if (webNotificationOpenHandler === handler) {
      webNotificationOpenHandler = null;
    }
    navigator.serviceWorker?.removeEventListener("message", onMessage);
  };
}
