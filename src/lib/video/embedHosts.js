const EMBED_HOST_PATTERN = /(^|\.)(4h\.b9p2m6c\.shop|[a-z0-9-]+\.b9p2m6c\.shop|[0-9][a-z0-9]\.[a-z0-9]+\.shop|[a-z0-9-]+\.anime4up\.rest|(?:[a-z0-9-]+\.)?embed4me\.com|voe\.sx|vidzy\.(?:cc|live|org)|(?:[a-z0-9-]+\.)?filemoon\.(?:to|sx|com)|(?:[a-z0-9-]+\.)?mp4upload\.com|(?:[a-z0-9-]+\.)?share4max\.(?:com|org)|vkvideo\.ru|(?:[a-z0-9-]+\.)?playmogo\.com|(?:[a-z0-9-]+\.)?rubyvidhub\.com|(?:[a-z0-9-]+\.)?uqload\.(?:com|net|to|cx|vc)|(?:[a-z0-9-]+\.)?dood\.(?:com|watch)|(?:[a-z0-9-]+\.)?streamruby\.com|videa\.hu|96ar\.com|(?:[a-z0-9-]+\.)?fsvid\.lol|(?:[a-z0-9-]+\.)?kakaflix\.[a-z]{2,}|(?:[a-z0-9-]+\.)?flixeo\.xyz|(?:[a-z0-9-]+\.)?multiup\.us|(?:[a-z0-9-]+\.)?netu\.[a-z]{2,}|(?:[a-z0-9-]+\.)?filmoon\.[a-z]{2,}|sandratableother\.com|diananatureforeign\.com|drive\.google\.com|(?:www\.)?dailymotion\.com|(?:www\.)?ok\.ru|bysezoxexe\.com)$/i;

const EMBED_NO_SANDBOX_HOSTS = /(^|\.)(voe\.sx|sandratableother\.com|diananatureforeign\.com|drive\.google\.com|(?:www\.)?dailymotion\.com|(?:www\.)?ok\.ru|(?:[a-z0-9-]+\.)?flixeo\.xyz|(?:[a-z0-9-]+\.)?multiup\.us|(?:[a-z0-9-]+\.)?kakaflix\.[a-z]{2,})$/i;

const AD_HOST_PATTERN = /(doubleclick|googlesyndication|googleadservices|googletagmanager|googletagservices|google-analytics|adservice\.google|pagead2\.|fundingchoicesmessages\.google|popads|exoclick|clickadu|adsterra|propellerads|outbrain|taboola|mgid|revcontent|juicyads|trafficjunky|tsyndicate|adnxs|rubiconproject|pubmatic|openx\.net|play\.google\.com|market\.android\.com)/i;

const ALLOWED_GOOGLE_HOST_PATTERN = /(^|\.)(drive\.google\.com|googleusercontent\.com)$/i;

export const EMBED_IFRAME_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-presentation",
  "allow-forms",
].join(" ");

export function isProxiedSourceEmbedUrl(url = "") {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    return /^\/api\/sources\/[^/]+\/embed$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isAllowedEmbedHost(hostname = "") {
  return EMBED_HOST_PATTERN.test(String(hostname).toLowerCase());
}

export function embedHostRequiresOpenIframe(hostname = "") {
  return EMBED_NO_SANDBOX_HOSTS.test(String(hostname).toLowerCase());
}

export function isGoogleDriveEmbedUrl(url = "") {
  try {
    return new URL(url).hostname.toLowerCase() === "drive.google.com";
  } catch {
    return false;
  }
}

export function resolveEmbedReferrerPolicy(url = "") {
  if (isProxiedSourceEmbedUrl(url)) {
    return "strict-origin-when-cross-origin";
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "drive.google.com" || host.endsWith(".googleusercontent.com")) {
      return "strict-origin-when-cross-origin";
    }
    if (/dailymotion\.com$/i.test(host) || host === "ok.ru" || host.endsWith(".ok.ru")) {
      return "strict-origin-when-cross-origin";
    }
    if (/multiup\.|flixeo\.|96ar\.com|sandratableother|diananatureforeign|uqload\./i.test(host)) {
      return "no-referrer-when-downgrade";
    }
  } catch {
    // ignore
  }
  return "no-referrer";
}

export function resolveEmbedAllow(url = "") {
  const base = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  if (isGoogleDriveEmbedUrl(url)) {
    return `${base}; autoplay`;
  }
  return base;
}

export function resolveEmbedIframeSandbox(url = "") {
  if (isProxiedSourceEmbedUrl(url)) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (embedHostRequiresOpenIframe(host)) return undefined;
    return EMBED_IFRAME_SANDBOX;
  } catch {
    return EMBED_IFRAME_SANDBOX;
  }
}

export function isBlockedAdUrl(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_GOOGLE_HOST_PATTERN.test(host)) return false;
    if (AD_HOST_PATTERN.test(host)) return true;
    if (/(^|\.)google\.[a-z.]{2,}$/i.test(host)) {
      const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
      return /\/aclk|\/pagead|\/ads|adurl=|\/url\?|\/search|\/store|^\/?\?|^\/$/.test(path);
    }
    return false;
  } catch {
    return true;
  }
}

export function isAllowedEmbedUrl(url = "") {
  if (isProxiedSourceEmbedUrl(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (isBlockedAdUrl(parsed.href)) return false;
    return isAllowedEmbedHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function installEmbedPopupGuards() {
  const originalOpen = window.open;
  window.open = () => null;

  const shouldBlockHref = (href) => {
    const target = String(href || "").trim();
    if (!target || target.startsWith("#") || target.startsWith("javascript:")) return false;
    try {
      const url = new URL(target, window.location.href);
      if (url.protocol === "intent:" || url.protocol === "market:") return true;
      return isBlockedAdUrl(url.href);
    } catch {
      return true;
    }
  };

  const onClickCapture = (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href") || anchor.href || "";
    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (shouldBlockHref(href) || target === "_blank" || target === "_new") {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onAuxClick = (event) => {
    if (event.button !== 1) return;
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("auxclick", onAuxClick, true);

  return () => {
    window.open = originalOpen;
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("auxclick", onAuxClick, true);
  };
}
