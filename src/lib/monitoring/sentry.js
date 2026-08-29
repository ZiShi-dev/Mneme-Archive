import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  const dsn = String(import.meta.env.VITE_SENTRY_DSN || "").trim();
  if (!dsn || initialized) return false;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1 : 0,
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}

export function captureException(error, context = {}) {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

export { Sentry };
