export const AD_SEGMENT_PATTERN = /(?:\/ads?(?:\/|_|\.)|[_-]ad[_-]|\/ad\.|preroll|midroll|postroll|\/troll\/|\/pub(?:licite)?\/|doubleclick|googlesyndication|adsterra|popads|exoclick|outbrain|\/commercial\/|\/spot\/|fake\.m3u8|decoy)/i;

export function isAdSegmentUrl(url = "") {
  const value = String(url).trim();
  if (!value || value.startsWith("#")) return false;
  return AD_SEGMENT_PATTERN.test(value);
}

export function isM3u8Payload(contentType = "", bodyText = "") {
  if (/mpegurl|m3u8/i.test(contentType)) return true;
  return String(bodyText).trimStart().startsWith("#EXTM3U");
}

function isSkippableAdTag(line = "") {
  const trimmed = String(line).trim();
  if (/^#EXT-X-CUE-(OUT|IN)/i.test(trimmed)) return true;
  if (/^#EXT-X-DATERANGE/i.test(trimmed) && /(?:SCTE35|INTERSTITIAL|\bAD\b|X-AD)/i.test(trimmed)) return true;
  if (/^#EXT-X-KEY/i.test(trimmed) && /URI="[^"]*ad/i.test(trimmed)) return true;
  if (trimmed.startsWith("#")) {
    const uriMatch = trimmed.match(/URI="([^"]+)"/i);
    if (uriMatch && isAdSegmentUrl(uriMatch[1])) return true;
  }
  return false;
}

function popSegmentMetadata(output) {
  while (output.length > 0) {
    const prev = output[output.length - 1].trim();
    if (!prev) {
      output.pop();
      continue;
    }
    if (
      /^#EXTINF/i.test(prev)
      || /^#EXT-X-STREAM-INF/i.test(prev)
      || /^#EXT-X-I-FRAME-STREAM-INF/i.test(prev)
      || /^#EXT-X-DISCONTINUITY/i.test(prev)
      || /^#EXT-X-BYTERANGE/i.test(prev)
      || /^#EXT-X-PROGRAM-DATE-TIME/i.test(prev)
    ) {
      output.pop();
      continue;
    }
    break;
  }
}

export function filterM3u8Ads(body = "") {
  const lines = String(body).split(/\r?\n/);
  const output = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      output.push(line);
      continue;
    }

    if (isSkippableAdTag(trimmed)) continue;

    if (trimmed.startsWith("#")) {
      output.push(line);
      continue;
    }

    if (isAdSegmentUrl(trimmed)) {
      popSegmentMetadata(output);
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

export function rewriteM3u8Playlist(body = "", baseUrl = "", buildProxyUrl) {
  const base = new URL(baseUrl);
  return String(body)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        const uriMatch = trimmed.match(/URI="([^"]+)"/i);
        if (!uriMatch) return line;
        const resolved = new URL(uriMatch[1], base).toString();
        if (isAdSegmentUrl(resolved)) return line;
        return line.replace(uriMatch[1], buildProxyUrl(resolved));
      }
      const resolved = new URL(trimmed, base).toString();
      if (isAdSegmentUrl(resolved)) return "";
      return buildProxyUrl(resolved);
    })
    .filter((line) => line !== "")
    .join("\n");
}

export async function fetchProxiedHlsResource({
  target,
  referer = "",
  label = "stream",
  buildProxyUrl,
  timeoutMs = 60_000,
}) {
  const response = await fetch(target, {
    headers: {
      accept: "*/*",
      referer,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Flux ${label} indisponible (${response.status})`);

  const contentType = response.headers.get("content-type") ?? "";
  const rawBuffer = new Uint8Array(await response.arrayBuffer());
  const bodyText = new TextDecoder().decode(rawBuffer);

  if (isM3u8Payload(contentType, bodyText)) {
    const sanitized = filterM3u8Ads(bodyText);
    const rewritten = rewriteM3u8Playlist(sanitized, target, buildProxyUrl);
    return {
      kind: "stream",
      contentType: "application/vnd.apple.mpegurl",
      buffer: new TextEncoder().encode(rewritten),
      cacheControl: "no-store",
    };
  }

  return {
    kind: "stream",
    contentType: contentType || "application/octet-stream",
    buffer: rawBuffer,
    cacheControl: "public, max-age=86400, immutable",
  };
}
