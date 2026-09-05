export function getDocumentFullscreenElement(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return null;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function isFullscreenWithinRoot(root, fullscreenElement) {
  if (!root) return false;
  const active = fullscreenElement === undefined
    ? getDocumentFullscreenElement(root.ownerDocument)
    : fullscreenElement;
  if (!active) return false;
  return active === root || Boolean(root.contains?.(active));
}
