import { UserConfig } from "vite";

/**
 * What the background worker and the content script are built with alike —
 * each config adds its entry point — and what the tests run with, so that
 * `__DEV__` means the same there.
 */
export const baseConfig = (mode: string): UserConfig => ({
  root: "src",
  build: {
    // Transpiled for browsers older than the oldest we support (Chrome/Edge 102,
    // Firefox 115): Vite 6's default, which Vite 7 raised to Chrome 107.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    minify: mode !== "development",
    outDir: "../dist",
    emptyOutDir: false,
  },
  // Keep the libraries' license comments (@license, /*!) in the bundles, as
  // Vite 6 did; Vite 7 drops them by default.
  esbuild: { legalComments: "inline" },
  define: {
    // Developer breadcrumbs are compiled out of production builds.
    __DEV__: JSON.stringify(mode === "development"),
  },
});
