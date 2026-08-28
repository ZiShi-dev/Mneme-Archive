import React from "react";
import { isChromebookApp } from "../../config/appFlavor";
import { CineMark } from "./CineMark";
import { MnemeMark } from "./MnemeMark";

export function AppMark({
  size = 32,
  variant = "auto",
  appearance,
  alt = "",
  decorative = true,
  className = "",
}) {
  if (isChromebookApp) {
    return (
      <CineMark
        size={size}
        decorative={decorative}
        className={className}
      />
    );
  }

  return (
    <MnemeMark
      size={size}
      variant={variant}
      appearance={appearance}
      alt={alt}
      decorative={decorative}
      className={className}
    />
  );
}
