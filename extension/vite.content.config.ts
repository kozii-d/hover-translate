import { defineConfig } from "vite";

import * as dotenv from "dotenv";
import * as path from "path";
import copy from "rollup-plugin-copy";

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
        },
        plugins: [
          copy({
            targets: [
              { src: "./src/content/styles.css", dest: "./dist" },
            ]
          })
        ],
      },
    },
    define: {
      __API_URL__: JSON.stringify(process.env.API_URL),
    },
    resolve: {
      alias: {
        "chrome": "webextension-polyfill"
      },
    },
  };
});