import { defineConfig, mergeConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import viteConfig from "./vite.config.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The build's config — aliases, plugins (React, svgr), esbuild options — with
// what only the tests need on top.
export default mergeConfig(viteConfig, defineConfig({
  resolve: {
    alias: {
      // The fake `chrome` and network the extension's tests use.
      "@extension-test": resolve(__dirname, "../extension/test"),
    },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    environment: "jsdom",
    // Spies and stubbed globals do not leak into the next test.
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text-summary", "html", "json-summary"],
    },
  },
}));
