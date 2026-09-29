import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, mergeConfig, Plugin } from "vite";
import { baseConfig } from "./vite.base.config.ts";

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

export default defineConfig(({ mode }) => mergeConfig(baseConfig(mode), {
  build: {
    rollupOptions: {
      input: "./src/content/content.ts",
      output: {
        inlineDynamicImports: true,
        entryFileNames: ({ name }: { name: string }) => {
          return `${name}.bundle.js`;
        },
      },
    },
  },
  plugins: [copyStyles],
}));
