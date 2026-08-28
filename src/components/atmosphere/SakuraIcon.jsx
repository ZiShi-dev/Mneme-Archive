import React from "react";

export function SakuraIcon({ size = 18, className = "", decorative = false }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden={decorative ? "true" : undefined}
    >
      <path d="M12 10.2c.4-2.8-.4-5.4-2.2-7.2 2.3.4 4.3 1.7 5.4 3.7 1.1-2 3.1-3.3 5.4-3.7-1.8 1.8-2.6 4.4-2.2 7.2 2.6-.9 5.3-.7 7.4.8-2.1 1.1-3.5 3.2-3.8 5.6 2.4.8 4.2 2.5 5 4.8-2.4-.6-5 .1-6.8 1.9 1.2 2.5.9 5.3-.6 7.6-1.2-2.2-3.5-3.7-6.1-4.1-1.1 2.6-3.4 4.5-6.2 5.1.7-2.4.3-5.1-1.3-7.2-2.3-1.2-3.9-3.5-4.3-6.1 2.3.7 4.8.3 6.7-1.2C7.2 13.3 6 11.2 5.8 8.8c2.1 1.4 4.8 1.6 7.4.8Z" opacity=".92" />
      <circle cx="12" cy="12" r="1.7" />
    </svg>
  );
}

export function SakuraPetalMark({ className = "" }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 1.2c-1.8 3.4-4.8 6.6-4.2 12.1.4 3.6 3.4 6.2 6.3 5.4 2.5-.7 4.2-3.4 4-6.8C15.7 6.8 12.6 3.8 10 1.2Z" />
    </svg>
  );
}
