const buckets = new Map();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;

function resolveClientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
} = {}) {
  return function checkRateLimit(req, res) {
    const ip = resolveClientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count <= maxRequests) return false;

    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Retry-After", String(retryAfter));
    res.end(JSON.stringify({ error: "Trop de requêtes. Réessayez plus tard." }));
    return true;
  };
}

export function createRateLimitMiddleware(options = {}) {
  const check = createRateLimiter(options);
  return (req, res, next) => {
    if (check(req, res)) return;
    next();
  };
}

export function shouldRateLimitSourceRequest(url = "") {
  return String(url).startsWith("/api/sources/");
}
