import { defineConfig } from "vite";

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: [
        "./src/content/content.js",
        "./src/background/background.js",
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