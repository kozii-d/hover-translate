import { defineConfig } from "vite";

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: [
        "./src/content/content.ts",
        "./src/background/background.ts",
      ],
      output: {
        entryFileNames: ({ name }) => {
          return `${name}.bundle.js`;
        }
      }
    },
  },
  define: {
    __API_URL__: JSON.stringify(process.env.API_URL),
  },
});