import { useEffect } from "react";
import {
  ensureBackgroundDownloadAppListener,
  resumeBackgroundDownloads,
} from "../lib/downloads/backgroundDownloadRunner.js";

export function useBackgroundDownloadResume() {
  useEffect(() => {
    ensureBackgroundDownloadAppListener();
    void resumeBackgroundDownloads();
  }, []);
}
