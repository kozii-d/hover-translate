import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), svgr()],
  base: "./",
  // Keep the libraries' license comments (@license, /*!) in the bundles, as
  // Vite 6 did; Vite 7 drops them by default.
  esbuild: { legalComments: "inline" },
  build: {
    // Transpiled for browsers older than the oldest we support (Chrome/Edge 102,
    // Firefox 115): Vite 6's default, which Vite 7 raised to Chrome 107.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    // The popup is read from the extension's own files, never downloaded: one
    // large chunk costs nothing, so it is not split. The limit sits about
    // 85 kB above the main chunk (~565 kB) to flag real growth, such as a new
    // library.
    chunkSizeWarningLimit: 650,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Code shared with the content script and the background worker — the
      // storage wrapper today. Only `extension/src/common` is meant to be
      // reached this way.
      "@extension": resolve(__dirname, "../extension/src"),
    },
  },
});
