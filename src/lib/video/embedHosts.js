const EMBED_HOST_PATTERN = /(^|\.)(4h\.b9p2m6c\.shop|[a-z0-9-]+\.b9p2m6c\.shop|[a-z0-9-]+\.anime4up\.rest|voe\.sx|vidzy\.(?:cc|live|org)|(?:[a-z0-9-]+\.)?filemoon\.(?:to|sx|com)|(?:[a-z0-9-]+\.)?mp4upload\.com|(?:[a-z0-9-]+\.)?share4max\.(?:com|org)|vkvideo\.ru|(?:[a-z0-9-]+\.)?playmogo\.com|(?:[a-z0-9-]+\.)?rubyvidhub\.com|(?:[a-z0-9-]+\.)?uqload\.(?:com|net|to|cx)|(?:[a-z0-9-]+\.)?dood\.(?:com|watch)|(?:[a-z0-9-]+\.)?streamruby\.com|videa\.hu|96ar\.com|(?:[a-z0-9-]+\.)?fsvid\.lol|(?:[a-z0-9-]+\.)?kakaflix\.[a-z]{2,}|(?:[a-z0-9-]+\.)?netu\.[a-z]{2,}|(?:[a-z0-9-]+\.)?filmoon\.[a-z]{2,}|sandratableother\.com|diananatureforeign\.com)$/i;

const EMBED_NO_SANDBOX_HOSTS = /(^|\.)(voe\.sx|sandratableother\.com|diananatureforeign\.com)$/i;

const AD_HOST_PATTERN = /(doubleclick|googlesyndication|popads|exoclick|clickadu|adsterra|propellerads|outbrain|taboola|mgid|revcontent)/i;

export const EMBED_IFRAME_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-presentation",
  "allow-forms",
  "allow-fullscreen",
].join(" ");

export function isAllowedEmbedHost(hostname = "") {
  return EMBED_HOST_PATTERN.test(String(hostname).toLowerCase());
}

export function embedHostRequiresOpenIframe(hostname = "") {
  return EMBED_NO_SANDBOX_HOSTS.test(String(hostname).toLowerCase());
}

export function resolveEmbedIframeSandbox(url = "") {
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
    const host = new URL(url).hostname.toLowerCase();
    return AD_HOST_PATTERN.test(host);
  } catch {
    return true;
  }
}

export function isAllowedEmbedUrl(url = "") {
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

  const onClickCapture = (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (target !== "_blank" && target !== "_new") return;
    event.preventDefault();
    event.stopPropagation();
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
