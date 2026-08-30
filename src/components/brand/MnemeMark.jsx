import React, { useId } from "react";
import { resolveMnemeMarkPalette } from "../../lib/brand/mnemeMarkPalettes.js";
import { MnemeMarkArt } from "./MnemeMarkArt.jsx";

export function MnemeMark({
  size = 32,
  variant = "auto",
  appearance,
  alt = "Mneme Archive",
  decorative = true,
  className = "",
}) {
  const uid = useId().replace(/:/g, "");
  const palette = resolveMnemeMarkPalette(variant, appearance);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`mneme-mark ${className}`.trim()}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : alt}
    >
      <MnemeMarkArt palette={palette} uid={uid} />
    </svg>
  );
}
