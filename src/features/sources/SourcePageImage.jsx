import React, { useEffect, useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider";
import { resolveSourceImageUrl } from "./sourceApi";

export function SourcePageImage({ sourceId, page, index }) {
  const { t } = useI18n();
  const [src, setSrc] = useState("");
  const [status, setStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);
  const pageNumber = index + 1;

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setSrc("");

    resolveSourceImageUrl(sourceId, page.src)
      .then((url) => {
        if (!active) return;
        setSrc(url);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => { active = false; };
  }, [page.src, sourceId, retryCount]);

  if (status === "error") {
    return (
      <div className="live-reader-pages__error-card" role="alert">
        <span className="live-reader-pages__error-icon" aria-hidden="true">
          <ImageOff size={28} />
        </span>
        <strong>{t("reader.page.displayFailed", { n: pageNumber })}</strong>
        <p>{t("reader.page.loadHint")}</p>
        <button
          type="button"
          className="live-reader-pages__retry"
          onClick={() => setRetryCount((count) => count + 1)}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (status !== "ready" || !src) {
    return (
      <div
        className="live-reader-pages__placeholder"
        aria-busy="true"
        aria-label={t("reader.page.loadingAria", { n: pageNumber })}
      />
    );
  }

  return (
    <img
      src={src}
      alt={page.alt || t("reader.page.alt", { n: pageNumber })}
      className="live-reader-pages__image"
      loading={index < 2 ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStatus("error")}
    />
  );
}
