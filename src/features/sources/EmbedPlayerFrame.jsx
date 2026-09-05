import React, { useEffect, useRef } from "react";
import {
  isAllowedEmbedUrl,
  resolveEmbedAllow,
  resolveEmbedIframeSandbox,
  resolveEmbedReferrerPolicy,
} from "../../lib/video/embedHosts";
import { useI18n } from "../../i18n/I18nProvider";

const EMBED_LOAD_TIMEOUT_MS = 22_000;

export function EmbedPlayerFrame({
  src,
  title,
  className = "live-video-embed__frame",
  onBlocked,
}) {
  const { t } = useI18n();
  const allowed = Boolean(src) && isAllowedEmbedUrl(src);
  const sandbox = resolveEmbedIframeSandbox(src);
  const onBlockedRef = useRef(onBlocked);
  const loadedRef = useRef(false);
  onBlockedRef.current = onBlocked;

  useEffect(() => {
    loadedRef.current = false;
    if (!allowed) {
      onBlockedRef.current?.();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (!loadedRef.current) onBlockedRef.current?.();
    }, EMBED_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [allowed, src]);

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
      onLoad={() => {
        loadedRef.current = true;
      }}
    />
  );
}
