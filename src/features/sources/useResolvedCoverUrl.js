import { useEffect, useState } from "react";
import { peekResolvedImageUrl, resolveSourceImageUrl } from "./sourceApi";

function initialCoverUrl(sourceId, src) {
  if (!src) return null;
  const peeked = peekResolvedImageUrl(sourceId, src);
  if (peeked) return peeked;
  return sourceId ? null : src;
}

export function useResolvedCoverUrl(sourceId, src) {
  const [url, setUrl] = useState(() => initialCoverUrl(sourceId, src));

  useEffect(() => {
    if (!src) {
      setUrl(null);
      return undefined;
    }
    if (!sourceId) {
      setUrl(src);
      return undefined;
    }

    const peeked = peekResolvedImageUrl(sourceId, src);
    if (peeked) setUrl(peeked);
    else setUrl(null);

    let active = true;
    resolveSourceImageUrl(sourceId, src)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl((current) => current || peeked || src);
      });
    return () => { active = false; };
  }, [sourceId, src]);

  return url;
}
