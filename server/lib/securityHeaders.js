const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: http://127.0.0.1:* http://localhost:*",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' https: blob:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* https: ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Security-Policy", DEV_CSP);
}

export function createSecurityHeadersMiddleware() {
  return (_req, res, next) => {
    applySecurityHeaders(res);
    next();
  };
}
