import { Capacitor } from "@capacitor/core";
import {
  BackgroundTask,
  BackgroundTaskResult,
  BackgroundTaskStatus,
} from "@capgo/capacitor-background-task";
import { isChromebookApp } from "../../config/appFlavor.js";
import { getActiveBackgroundJob } from "./backgroundDownloadQueue.js";
import { processBackgroundDownloadBurst } from "./backgroundDownloadRunner.js";

export const BACKGROUND_DOWNLOAD_TASK = "living-archive-offline-download";
const MIN_BACKGROUND_INTERVAL_MINUTES = 15;
const CHAPTERS_PER_WAKE = 2;

const isBackgroundTaskEnabled = () => Capacitor.isNativePlatform() && !isChromebookApp;

if (isBackgroundTaskEnabled()) {
  BackgroundTask.defineTask(BACKGROUND_DOWNLOAD_TASK, async () => {
    try {
      const active = await getActiveBackgroundJob();
      if (!active) {
        await unregisterBackgroundDownloadTask();
        return BackgroundTaskResult.Success;
      }
      await processBackgroundDownloadBurst(CHAPTERS_PER_WAKE);
      const remaining = await getActiveBackgroundJob();
      if (!remaining) {
        await unregisterBackgroundDownloadTask();
      }
      return BackgroundTaskResult.Success;
    } catch {
      return BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundDownloadTask() {
  if (!isBackgroundTaskEnabled()) return false;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTaskStatus.Available) return false;

  const isRegistered = await BackgroundTask.isTaskRegisteredAsync(BACKGROUND_DOWNLOAD_TASK);
  if (isRegistered) return true;

  await BackgroundTask.registerTaskAsync(BACKGROUND_DOWNLOAD_TASK, {
    minimumInterval: MIN_BACKGROUND_INTERVAL_MINUTES,
    requiresNetwork: true,
  });
  return true;
}

export async function unregisterBackgroundDownloadTask() {
  if (!isBackgroundTaskEnabled()) return;
  const isRegistered = await BackgroundTask.isTaskRegisteredAsync(BACKGROUND_DOWNLOAD_TASK);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_DOWNLOAD_TASK);
  }
}
