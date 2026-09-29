import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, Plugin } from "vite";

// The manifest loads styles.css next to the bundle; nothing imports it.
const copyStyles: Plugin = {
  name: "copy-content-styles",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "styles.css",
      source: readFileSync(resolve(__dirname, "src/content/styles.css"), "utf8"),
    });
  },
};

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
        input: "./src/content/content.ts",
        output: {
          inlineDynamicImports: true,
          entryFileNames: ({ name }) => {
            return `${name}.bundle.js`;
          },
        },
      },
    },
    plugins: [copyStyles],
    // Keep the libraries' license comments (@license, /*!) in the bundles, as
    // Vite 6 did; Vite 7 drops them by default.
    esbuild: { legalComments: "inline" },
    define: {
      // Developer breadcrumbs are compiled out of production builds.
      __DEV__: JSON.stringify(mode === "development"),
    },
  };
});