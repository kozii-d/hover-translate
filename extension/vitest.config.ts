import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vite.base.config.ts";

export default defineConfig(({ mode }) => mergeConfig(baseConfig(mode), {
  // The build's root is `src`; the tests and their fakes live next to it.
  root: ".",
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // `node` unless a file asks for a DOM with `// @vitest-environment jsdom`.
    environment: "node",
    // Spies and stubbed globals do not leak into the next test.
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "html", "json-summary"],
      // No threshold for the whole: only the modules whose logic the tests
      // cover on purpose may not lose that coverage unnoticed.
      thresholds: {
        "src/common/translators/findClosestLanguage.ts": { lines: 90, branches: 90 },
        "src/common/translators/translatorError.ts": { lines: 90, branches: 90 },
        "src/common/ratingPrompt.ts": { lines: 90, branches: 90 },
        "src/content/utils/wordSegmenter.ts": { lines: 90, branches: 90 },
        "src/background/services/settingsMigrationsService.ts": { lines: 90, branches: 90 },
        // Branches: a migration that exists — there is none yet.
        "src/background/services/tooltipThemeMigrationsService.ts": { lines: 90 },
        "src/content/core/translationCore.ts": { lines: 90, branches: 90 },
        "src/common/services/storageService.ts": { lines: 90, branches: 90 },
        "src/common/translators/google/google.ts": { lines: 90, branches: 90 },
        "src/common/translators/bing/bing.ts": { lines: 90, branches: 90 },
        "src/common/translators/deepl/deepl.ts": { lines: 90, branches: 90 },
        "src/common/translators/replacementTranslator.ts": { lines: 90, branches: 90 },
        "src/common/translators/withdrawnTranslators.ts": { lines: 90, branches: 90 },
        "src/common/translators/TranslatorFactory.ts": { lines: 90, branches: 90 },
      },
    },
  },
}));
