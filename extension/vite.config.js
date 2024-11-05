import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: [
        "./src/content.js",
        "./src/background.js",
      ],
      output: {
        entryFileNames: ({ name }) => {
          return `${name}.bundle.js`;
        }
      }
    },
  },
});