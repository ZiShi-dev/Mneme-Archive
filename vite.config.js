import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mangaSourcesPlugin } from "./server/mangaSourcesPlugin";

export default defineConfig({
  base: "./",
  plugins: [react({ jsxRuntime: "automatic" }), mangaSourcesPlugin()],
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
  },
});
