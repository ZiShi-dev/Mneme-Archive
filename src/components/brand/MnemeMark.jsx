import React from "react";
import markLight from "../../assets/brand/mneme-mark.png";
import markDark from "../../assets/brand/mneme-mark-dark.png";
import { isDarkTheme } from "../../lib/theme/appearance";

function resolveDark(variant, appearance) {
  if (variant === "dark") return true;
  if (variant === "light") return false;
  if (appearance) return isDarkTheme(appearance);
  if (typeof document !== "undefined") {
    return isDarkTheme(document.body?.dataset?.theme);
  }
  return true;
}

export function MnemeMark({
  size = 32,
  variant = "auto",
  appearance,
  alt = "",
  decorative = true,
  className = "",
}) {
  const src = resolveDark(variant, appearance) ? markDark : markLight;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={decorative ? "" : alt}
      className={`mneme-mark ${className}`.trim()}
      draggable={false}
    />
  );
}
