const { defineConfig } = require("@playwright/test");

// End-to-end tests: the built extension in Playwright's Chromium, on local
// pages with the markup of YouTube's player (`e2e/`). Build first
// (`npm run build`), then `npm run test:e2e`.
module.exports = defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.js",
  globalSetup: "./e2e/globalSetup.js",
  outputDir: "test-results/e2e",
  fullyParallel: true,
  // A test that fails once is reported, not quietly retried.
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
