import { Capacitor } from "@capacitor/core";
import {
  BackgroundTask,
  BackgroundTaskResult,
  BackgroundTaskStatus,
} from "@capgo/capacitor-background-task";
import { isChromebookApp } from "../../config/appFlavor";
import { runBackgroundFollowSync } from "./runBackgroundFollowSync";

export const FOLLOW_BACKGROUND_TASK = "living-archive-follow-sync";
const MIN_BACKGROUND_INTERVAL_MINUTES = 15;

const isBackgroundTaskEnabled = () => Capacitor.isNativePlatform() && !isChromebookApp;

if (isBackgroundTaskEnabled()) {
  BackgroundTask.defineTask(FOLLOW_BACKGROUND_TASK, async () => {
    try {
      const { showChapterUpdateNotifications } = await import("../notifications/nativeNotifications");
      const result = await runBackgroundFollowSync();
      if (result.events?.length) {
        await showChapterUpdateNotifications(result.events);
      }
      return BackgroundTaskResult.Success;
    } catch {
      return BackgroundTaskResult.Failed;
    }
  });
}

export async function registerFollowBackgroundTask(intervalMinutes = MIN_BACKGROUND_INTERVAL_MINUTES) {
  if (!isBackgroundTaskEnabled()) return false;

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTaskStatus.Available) return false;

  const minimumInterval = Math.max(MIN_BACKGROUND_INTERVAL_MINUTES, Number(intervalMinutes) || MIN_BACKGROUND_INTERVAL_MINUTES);
  const isRegistered = await BackgroundTask.isTaskRegisteredAsync(FOLLOW_BACKGROUND_TASK);

  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync(FOLLOW_BACKGROUND_TASK, {
      minimumInterval,
      requiresNetwork: true,
    });
    return true;
  }

  await BackgroundTask.unregisterTaskAsync(FOLLOW_BACKGROUND_TASK);
  await BackgroundTask.registerTaskAsync(FOLLOW_BACKGROUND_TASK, {
    minimumInterval,
    requiresNetwork: true,
  });
  return true;
}

export async function unregisterFollowBackgroundTask() {
  if (!isBackgroundTaskEnabled()) return;
  const isRegistered = await BackgroundTask.isTaskRegisteredAsync(FOLLOW_BACKGROUND_TASK);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(FOLLOW_BACKGROUND_TASK);
  }
}

export async function triggerFollowBackgroundTaskForTesting() {
  if (!isBackgroundTaskEnabled()) return false;
  return BackgroundTask.triggerTaskWorkerForTestingAsync();
}

export async function getFollowBackgroundTaskStatus() {
  if (!isBackgroundTaskEnabled()) {
    return { available: false, registered: false, platform: Capacitor.getPlatform() };
  }

  const status = await BackgroundTask.getStatusAsync();
  const registered = await BackgroundTask.isTaskRegisteredAsync(FOLLOW_BACKGROUND_TASK);
  return {
    available: status === BackgroundTaskStatus.Available,
    registered,
    platform: Capacitor.getPlatform(),
  };
}
