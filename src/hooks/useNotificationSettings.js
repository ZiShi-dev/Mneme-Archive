import { useEffect, useState } from "react";
import { usePersistedState } from "./usePersistedState";
import {
  getNotificationPermissionStatus,
  isNativeNotificationsAvailable,
  requestNotificationPermission,
  sendTestNotification,
} from "../lib/notifications/nativeNotifications";
import {
  getFollowBackgroundTaskStatus,
  triggerFollowBackgroundTaskForTesting,
} from "../lib/updates/backgroundFollowTask";
import { t } from "../i18n/runtime.js";

import { DEFAULT_APP_SETTINGS } from "../lib/settings/defaults";

const DEFAULT_SETTINGS = DEFAULT_APP_SETTINGS;

export function useNotificationSettings(pushToast) {
  const [settings, setSettings] = usePersistedState("mangashelf:settings", DEFAULT_SETTINGS);
  const [permission, setPermission] = useState({ granted: false, available: false, display: "web" });
  const [backgroundStatus, setBackgroundStatus] = useState({ available: false, registered: false, platform: "web" });

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermission);
    getFollowBackgroundTaskStatus().then(setBackgroundStatus);
  }, [settings.notifications, settings.backgroundSync]);

  const isNative = isNativeNotificationsAvailable();

  function toggle(key) {
    setSettings((current) => {
      const currentValue = key === "backgroundSync"
        ? current.backgroundSync !== false
        : Boolean(current[key]);
      const nextValue = !currentValue;
      const label = key === "notifications"
        ? (nextValue ? t("notify.enabledToast") : t("notify.disabledToast"))
        : key === "backgroundSync"
          ? (nextValue ? t("notify.backgroundOnToast") : t("notify.backgroundOffToast"))
          : t("settings.updated");
      pushToast?.({ type: "success", message: label });
      return { ...current, [key]: nextValue };
    });
  }

  function setPollMinutes(minutes) {
    setSettings((current) => ({ ...current, followPollMinutes: minutes }));
    pushToast?.({ type: "success", message: t("settings.pollUpdated", { minutes }) });
  }

  async function handleRequestPermission() {
    const result = await requestNotificationPermission();
    const status = await getNotificationPermissionStatus();
    setPermission(status);
    pushToast?.({
      type: result.granted ? "success" : "error",
      message: result.granted ? t("notify.phoneOn") : t("notify.phoneDenied"),
    });
  }

  async function handleTestNotification() {
    const result = await sendTestNotification();
    if (result.ok) {
      pushToast?.({ type: "success", message: t("notify.testSent") });
      return;
    }
    if (result.reason === "web") {
      pushToast?.({ type: "info", message: t("notify.androidOnly") });
      return;
    }
    pushToast?.({ type: "error", message: t("notify.grantFromPhone") });
  }

  async function handleTestBackgroundSync() {
    const triggered = await triggerFollowBackgroundTaskForTesting();
    if (!triggered) {
      pushToast?.({ type: "info", message: t("notify.backgroundAndroid") });
      return;
    }
    pushToast?.({ type: "success", message: t("notify.backgroundTest") });
    getFollowBackgroundTaskStatus().then(setBackgroundStatus);
  }

  return {
    settings,
    permission,
    backgroundStatus,
    isNative,
    toggleNotifications: () => toggle("notifications"),
    toggleBackgroundSync: () => toggle("backgroundSync"),
    setPollMinutes,
    handleRequestPermission,
    handleTestNotification,
    handleTestBackgroundSync,
  };
}
