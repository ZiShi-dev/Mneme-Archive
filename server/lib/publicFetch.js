import { isBlockedNetworkHost } from "./urlSecurity.js";

let serverTransport;
let serverDestinationValidator;

// Installed only by Node entry points; this module is also bundled for Capacitor.
export function configurePublicFetchTransport(transport, validateDestination) {
  serverTransport = transport;
  serverDestinationValidator = validateDestination;
}

// For delegated fetches. The remote solver must also enforce its own egress policy.
export async function validatePublicDestination(rawUrl) {
  const url = assertPublicHttpUrl(rawUrl);
  if (serverDestinationValidator) await serverDestinationValidator(url);
  return url;
}

export function assertPublicHttpUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)
    || url.username || url.password || isBlockedNetworkHost(url.hostname)) {
    throw new Error("Destination réseau non autorisée");
  }
  return url;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function publicFetch(rawUrl, options = {}) {
  let url = assertPublicHttpUrl(rawUrl);
  let init = { ...options };
  for (let hop = 0; hop <= 5; hop++) {
    init.signal?.throwIfAborted();
    const response = await (serverTransport || globalThis.fetch)(url.href, {
      ...init,
      redirect: "manual",
    });
    // Browsers cannot inspect cross-origin manual redirects. Fail closed.
    if (response.type === "opaqueredirect") throw new Error("Redirection réseau invérifiable");
    if (!REDIRECTS.has(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    await response.body?.cancel?.();
    if (options.redirect === "error" || hop === 5) throw new Error("Redirections réseau refusées ou trop nombreuses");
    const next = assertPublicHttpUrl(new URL(location, url));
    if (url.protocol === "https:" && next.protocol !== "https:") {
      throw new Error("Redirection HTTPS vers HTTP non autorisée");
    }
    const headers = new Headers(init.headers);
    headers.delete("host");
    if (next.origin !== url.origin) {
      for (const name of ["authorization", "proxy-authorization", "cookie", "cookie2", "referer"]) headers.delete(name);
    }
    const method = (init.method || "GET").toUpperCase();
    if ((response.status === 303 && method !== "HEAD")
      || ([301, 302].includes(response.status) && method === "POST")) {
      init = { ...init, method: "GET", body: undefined };
      for (const name of ["content-type", "content-length", "content-encoding", "transfer-encoding"]) headers.delete(name);
    }
    init = { ...init, headers };
    url = next;
  }
}
