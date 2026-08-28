const SHARED_CSP_DIRECTIVES = [
  "default-src 'self'",
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
  "object-src 'none'",
];

const DEV_SCRIPT_SRC = "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:";
const PROD_SCRIPT_SRC = "script-src 'self' blob:";

export function buildContentSecurityPolicy({ production = false } = {}) {
  const scriptSrc = production ? PROD_SCRIPT_SRC : DEV_SCRIPT_SRC;
  return [scriptSrc, ...SHARED_CSP_DIRECTIVES].join("; ");
}

export const DEV_CSP = buildContentSecurityPolicy({ production: false });
export const PROD_CSP = buildContentSecurityPolicy({ production: true });

export function isProductionSecurityMode() {
  return process.env.NODE_ENV === "production" || process.env.MANHAW_PROD_SECURITY === "1";
}

export function applySecurityHeaders(res, { production = isProductionSecurityMode() } = {}) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", production ? PROD_CSP : DEV_CSP);

  if (production) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

export function createSecurityHeadersMiddleware(options = {}) {
  return (_req, res, next) => {
    applySecurityHeaders(res, options);
    next();
  };
}
