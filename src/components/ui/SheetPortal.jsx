import { createPortal } from "react-dom";

const PORTAL_ID = "la-sheet-portal";

function getPortalRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(PORTAL_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PORTAL_ID;
    root.className = "la-sheet-portal";
    document.body.appendChild(root);
  }
  return root;
}

if (typeof document !== "undefined") {
  getPortalRoot();
}

export function SheetPortal({ children }) {
  const root = getPortalRoot();
  if (!root) return null;
  return createPortal(children, root);
}
