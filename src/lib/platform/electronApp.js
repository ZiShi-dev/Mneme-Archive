export function isElectronApp() {
  return typeof window !== "undefined" && window.cinevaultDesktop?.isElectron === true;
}

export function focusElectronApp() {
  window.cinevaultDesktop?.focusApp?.();
}

export function getDesktopNotificationChipKey() {
  return isElectronApp() ? "notify.desktopTrayChip" : "notify.desktopTabChip";
}
