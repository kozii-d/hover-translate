import { defineConfig } from "vite";

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig(({ mode }) => {
  return {
    root: "src",
    build: {
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
        }
      },
    },
    define: {
      __API_URL__: JSON.stringify(process.env.API_URL),
    },
  };
});