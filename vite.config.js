/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { mangaSourcesPlugin } from "./server/mangaSourcesPlugin";

const PWA_THEME = "#090A12";
const PWA_BACKGROUND = "#090A12";

export default defineConfig({
  base: "./",
  plugins: [
    react({ jsxRuntime: "automatic" }),
    mangaSourcesPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "pwa/icon.svg",
        "pwa/themes/**/*",
      ],
      manifest: {
        id: "./",
        name: "CinéVault",
        short_name: "CinéVault",
        description: "Films et séries VOSTFR — French Stream et Wiflix",
        lang: "fr",
        dir: "ltr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["standalone", "browser"],
        orientation: "any",
        theme_color: PWA_THEME,
        background_color: PWA_BACKGROUND,
        categories: ["entertainment", "video"],
        icons: [
          {
            src: "pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/sources/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "source-api",
              networkTimeoutSeconds: 12,
              expiration: {
                maxEntries: 48,
                maxAgeSeconds: 5 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "remote-images",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "vendor-react";
            if (id.includes("plyr") || id.includes("hls.js")) return "vendor-player";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/tests/setupVitest.js"],
    include: ["src/**/*.test.jsx"],
    css: false,
  },
});
