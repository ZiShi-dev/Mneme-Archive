export function areNotificationsOperational({
  settings,
  permission,
  supportsSystemNotifications,
}) {
  if (settings?.notifications === false) return false;
  if (supportsSystemNotifications && !permission?.granted) return false;
  return true;
}

export function resolveNotificationHeroTitleKey({
  settings,
  permission,
  supportsSystemNotifications,
}) {
  if (settings?.notifications === false) return "notify.offStatus";
  if (supportsSystemNotifications && !permission?.granted) return "notify.permissionNeeded";
  return "notify.on";
}
