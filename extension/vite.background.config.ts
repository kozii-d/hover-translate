import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    root: "src",
    build: {
      // Transpiled for browsers older than the oldest we support (Chrome/Edge 102,
      // Firefox 115): Vite 6's default, which Vite 7 raised to Chrome 107.
      target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
      minify: mode !== "development",
      outDir: "../dist",
      emptyOutDir: false,
      rollupOptions: {
        input: "./src/background/background.ts",
        output: {
          inlineDynamicImports: true,
          entryFileNames: ({ name }) => {
            return `${name}.bundle.js`;
          },
        }
      },
    },
    // Keep the libraries' license comments (@license, /*!) in the bundles, as
    // Vite 6 did; Vite 7 drops them by default.
    esbuild: { legalComments: "inline" },
    define: {
      // Developer breadcrumbs are compiled out of production builds.
      __DEV__: JSON.stringify(mode === "development"),
    },
  };
});