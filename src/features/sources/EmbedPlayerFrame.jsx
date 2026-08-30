import React, { useEffect } from "react";
import {
  isAllowedEmbedUrl,
  resolveEmbedAllow,
  resolveEmbedIframeSandbox,
  resolveEmbedReferrerPolicy,
} from "../../lib/video/embedHosts";
import { useI18n } from "../../i18n/I18nProvider";

export function EmbedPlayerFrame({
  src,
  title,
  className = "live-video-embed__frame",
  onBlocked,
}) {
  const { t } = useI18n();
  const allowed = Boolean(src) && isAllowedEmbedUrl(src);
  const sandbox = resolveEmbedIframeSandbox(src);

  useEffect(() => {
    if (!allowed) onBlocked?.();
  }, [allowed, onBlocked, src]);

  if (!allowed) {
    return (
      <div className="live-video-embed-blocked">
        <p>{t("reader.stream.embedBlocked")}</p>
        <small>{t("reader.stream.embedTryAnother")}</small>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      title={title}
      className={className}
      {...(sandbox ? { sandbox } : {})}
      allow={resolveEmbedAllow(src)}
      allowFullScreen
      referrerPolicy={resolveEmbedReferrerPolicy(src)}
      loading="eager"
    />
  );
}
