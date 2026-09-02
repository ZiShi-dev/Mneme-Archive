export function shouldRunFollowIntervalPoll({
  isNative = false,
  desktopBackground = false,
  appActive = true,
  documentHidden = false,
} = {}) {
  if (desktopBackground) return true;
  if (isNative) return true;
  if (!appActive) return false;
  if (documentHidden) return false;
  return true;
}
