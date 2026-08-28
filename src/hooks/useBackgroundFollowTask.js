import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { isChromebookApp } from "../config/appFlavor";
import {
  registerFollowBackgroundTask,
  unregisterFollowBackgroundTask,
} from "../lib/updates/backgroundFollowTask";

export function useBackgroundFollowTask(settings) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || isChromebookApp) return undefined;

    const enabled = settings?.notifications && settings?.backgroundSync !== false;

    if (!enabled) {
      unregisterFollowBackgroundTask();
      return undefined;
    }

    registerFollowBackgroundTask(settings?.backgroundIntervalMinutes || 15);
    return undefined;
  }, [
    settings?.backgroundIntervalMinutes,
    settings?.backgroundSync,
    settings?.notifications,
  ]);
}
