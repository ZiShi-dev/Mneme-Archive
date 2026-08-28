import { useEffect, useState } from "react";
import { resolveSourceImageUrl } from "./sourceApi";

export function useResolvedCoverUrl(sourceId, src) {
  const [url, setUrl] = useState(() => (sourceId && src ? null : src || null));

  useEffect(() => {
    if (!src) {
      setUrl(null);
      return undefined;
    }
    if (!sourceId) {
      setUrl(src);
      return undefined;
    }
    let active = true;
    setUrl(null);
    resolveSourceImageUrl(sourceId, src)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(src);
      });
    return () => { active = false; };
  }, [sourceId, src]);

  return url;
}
