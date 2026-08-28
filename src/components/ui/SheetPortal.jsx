import { createPortal } from "react-dom";

export function SheetPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
