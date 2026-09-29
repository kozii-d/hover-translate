import { defineConfig, mergeConfig } from "vite";
import { baseConfig } from "./vite.base.config.ts";

export default defineConfig(({ mode }) => mergeConfig(baseConfig(mode), {
  build: {
    rollupOptions: {
      input: "./src/background/background.ts",
      output: {
        inlineDynamicImports: true,
        entryFileNames: ({ name }: { name: string }) => {
          return `${name}.bundle.js`;
        },
      },
    },
  },
}));
