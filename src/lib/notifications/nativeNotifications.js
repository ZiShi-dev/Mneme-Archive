import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { t } from "../../i18n/runtime.js";
import { formatFollowNotificationBody } from "../updates/followMessaging";

export const CHAPTER_NOTIFICATION_CHANNEL = "living-archive-chapters";
const TEST_NOTIFICATION_ID = 900_001;

let initialized = false;

function hashNotificationId(key) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(index);
    hash |= 0;
  }
  return (Math.abs(hash) % 2_147_483_640) + 1;
}

export function isNativeNotificationsAvailable() {
  return Capacitor.isNativePlatform();
}

export async function initNativeNotifications() {
  if (!isNativeNotificationsAvailable() || initialized) return { granted: false, available: false };

  await LocalNotifications.createChannel({
    id: CHAPTER_NOTIFICATION_CHANNEL,
    name: t("notify.channelName"),
    description: t("notify.channelDescription"),
    importance: 5,
    visibility: 1,
    vibration: true,
    sound: "default",
    lights: true,
    lightColor: "#F38B2C",
  });

  initialized = true;
  return getNotificationPermissionStatus();
}

export async function getNotificationPermissionStatus() {
  if (!isNativeNotificationsAvailable()) {
    return { granted: false, available: false, display: "web" };
  }

  const result = await LocalNotifications.checkPermissions();
  const granted = result.display === "granted";
  return { granted, available: true, display: result.display };
}

export async function requestNotificationPermission() {
  if (!isNativeNotificationsAvailable()) {
    return { granted: false, available: false, display: "web" };
  }

  await initNativeNotifications();
  const result = await LocalNotifications.requestPermissions();
  const granted = result.display === "granted";
  return { granted, available: true, display: result.display };
}

export async function showChapterUpdateNotifications(events = []) {
  if (!events.length || !isNativeNotificationsAvailable()) return 0;

  const permission = await getNotificationPermissionStatus();
  if (!permission.granted) return 0;

  await initNativeNotifications();

  const notifications = events.map((event) => ({
    id: hashNotificationId(event.id),
    title: event.title,
    body: formatFollowNotificationBody(event),
    channelId: CHAPTER_NOTIFICATION_CHANNEL,
    smallIcon: "ic_stat_notify",
    group: "living-archive-updates",
    groupSummary: false,
    sound: "default",
    autoCancel: true,
    extra: {
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
  }));

  if (notifications.length > 1) {
    notifications.unshift({
      id: hashNotificationId(`summary:${Date.now()}`),
      title: t("app.name"),
      body: t("notify.summaryUpdates", { count: notifications.length }),
      channelId: CHAPTER_NOTIFICATION_CHANNEL,
      smallIcon: "ic_stat_notify",
      group: "living-archive-updates",
      groupSummary: true,
      sound: "default",
      autoCancel: true,
      extra: { kind: "summary" },
    });
  }

  await LocalNotifications.schedule({ notifications });
  return notifications.filter((entry) => !entry.groupSummary).length;
}

export async function sendTestNotification() {
  if (!isNativeNotificationsAvailable()) {
    return { ok: false, reason: "web" };
  }

  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return { ok: false, reason: "denied" };
  }

  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_NOTIFICATION_ID,
      title: t("app.name"),
      body: t("notify.testBody"),
      channelId: CHAPTER_NOTIFICATION_CHANNEL,
      smallIcon: "ic_stat_notify",
      sound: "default",
      autoCancel: true,
      extra: { kind: "test" },
    }],
  });

  return { ok: true };
}

export function registerNotificationOpenHandler(handler) {
  if (!isNativeNotificationsAvailable()) return () => {};

  const listener = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    handler(event?.notification?.extra || {});
  });

  return () => {
    listener.then((handle) => handle.remove());
  };
}
