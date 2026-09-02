import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { detectTextDirection } from "../../../lib/text/contentDirection";
import { formatChapterHeaderLabel, splitChapterHeaderLabel } from "../mediaPresentation";

export function ChapterLabel({
  chapter,
  unitLabel,
  className = "",
  as: Tag = "b",
  fallback = "—",
  compact = false,
}) {
  const { dir } = useI18n();
  const formatted = formatChapterHeaderLabel(chapter, unitLabel);
  if (!formatted) {
    return <Tag className={className} dir={dir} aria-hidden="true">{fallback}</Tag>;
  }

  const parts = splitChapterHeaderLabel(formatted);
  if (parts) {
    if (compact) {
      return (
        <Tag className={className ? `chapter-label chapter-label--compact ${className}` : "chapter-label chapter-label--compact"} dir="ltr">
          <span className="chapter-label__number">{parts.number}</span>
        </Tag>
      );
    }
    return (
      <Tag className={className ? `chapter-label ${className}` : "chapter-label"} dir={dir}>
        <span className="chapter-label__prefix">{parts.prefix}</span>
        {" "}
        <span className="chapter-label__number" dir="ltr">{parts.number}</span>
      </Tag>
    );
  }

  const textDir = detectTextDirection([formatted]) || dir || "auto";
  return (
    <Tag className={className ? `chapter-label ${className}` : "chapter-label"} dir={textDir}>
      {formatted}
    </Tag>
  );
}
