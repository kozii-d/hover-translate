const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("./extension.js");

// A change in the popup reaches a YouTube page that is already open, without
// reloading it: the content script follows `chrome.storage.onChanged`
// (`stateManager.ts`), and a different translator rebuilds its pipeline
// (`content.ts`).

/** The popup's Settings page, opened in a tab of its own. */
async function openSettings(context, extensionId) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);
  return popup;
}

async function pick(popup, field, option) {
  await popup.getByRole("combobox", { name: field }).click();
  await popup.getByRole("option", { name: option, exact: true }).click();
}

test.beforeEach(async ({ storage }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
});

test("a new target language applies on the open page", async ({ context, extensionId, openPlayer, storage, network }) => {
  const player = await openPlayer();
  await player.captions("run for your life");
  await player.word("run").hover();
  await expect(player.tooltip).toHaveText("бегать");

  const popup = await openSettings(context, extensionId);
  await pick(popup, /Translate to/, "German");
  await expect.poll(async () => (await storage.get("sync", "settings")).targetLanguageCode).toBe("de");

  await player.page.bringToFront();
  await player.word("life").hover();
  await expect(player.tooltip).toHaveText("[de] life");
  expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("tl")).toBe("de");
});

test.describe("with access to www.bing.com", () => {
  test.use({ grantedHosts: ["https://www.bing.com/*"] });

  test("switching to Bing applies on the open page", async ({ context, extensionId, openPlayer, storage, network }) => {
    const player = await openPlayer();
    await player.captions("run for your life");
    await player.word("run").hover();
    await expect(player.tooltip).toHaveText("бегать");

    const popup = await openSettings(context, extensionId);
    await pick(popup, /Translator/, "Bing");
    await expect.poll(async () => (await storage.get("sync", "settings")).translator).toBe("bing");

    await player.page.bringToFront();
    await player.word("life").hover();
    // Bing is asked from the service worker; the fake answers there as well.
    await expect(player.tooltip).toHaveText("life (bing)");
    expect(new URLSearchParams(network.to("www.bing.com").at(-1).body).get("to")).toBe("ru");
  });
});

// Chrome sizes the popup window to the page, Firefox to the width the page
// would like at 800 px (`max-content`); a tab 1280 px wide lays the page out
// the second way. The width is the tab labels' (`body { width: min-content }`),
// so it depends on the language and never on the page — nor on a long word
// saved to the word list, which wraps anywhere. Scrollbars are not drawn in a
// headless browser: they are a manual check.
const LONG_WORDS = [
  ["Donaudampfschifffahrtsgesellschaftskapitän", "captain of the Danube steamship company"],
  ["https://www.example.com/some/long/path", "https://www.example.com/some/long/path"],
];

for (const language of ["en", "ja", "ar"]) {
  test(`the popup is as wide on every page, in ${language}, long words in the word list too`, async ({ context, extensionId, storage }) => {
    const label = (ns, key) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_locales", language, `${ns}.json`), "utf8"))[key];
    const popup = await context.newPage();
    await popup.addInitScript((code) => localStorage.setItem("hoverTranslatePopupLanguage", code), language);
    await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);

    const widths = [];
    for (const ns of ["settings", "customize", "dictionary", "about"]) {
      await popup.getByRole("tab", { name: label(ns, "tabLabel"), exact: true }).click();
      await expect(popup.getByRole("heading", { name: label(ns, "pageTitle"), exact: true })).toBeVisible();
      await expect(popup.locator(".MuiSkeleton-root")).toHaveCount(0);
      widths.push(await popup.evaluate(() => document.body.getBoundingClientRect().width));
    }

    await storage.set("local", {
      savedTranslations: LONG_WORDS.map(([originalText, translatedText], index) => ({
        id: `long-${index}`,
        originalText,
        translatedText,
        sourceLanguageCode: "de",
        targetLanguageCode: "en",
        translatorName: "Google",
        timestamp: Date.now() + index,
      })),
    });
    await popup.getByRole("tab", { name: label("about", "tabLabel"), exact: true }).click();
    await popup.getByRole("tab", { name: label("dictionary", "tabLabel"), exact: true }).click();
    await expect(popup.getByText(LONG_WORDS[0][0], { exact: true })).toBeVisible();
    widths.push(await popup.evaluate(() => document.body.getBoundingClientRect().width));

    expect(widths).toEqual(Array(5).fill(widths[0]));
    expect(widths[0]).toBeGreaterThanOrEqual(380);
    expect(widths[0]).toBeLessThan(550);
  });
}

// Each tab is as wide as its label plus the tab's padding (16 px a side), so
// no label runs into the next one or is cut off (`overflow: hidden`). Only
// where the popup has reached its 550 px can the padding be squeezed, and a
// label must still fit whole. Every locale directory is checked, so a new
// language is too: if its labels do not fit, shorten them.
test("every tab label fits its tab, in every language", async ({ context, extensionId }) => {
  const locales = path.join(__dirname, "..", "_locales");
  const misfits = [];

  for (const language of fs.readdirSync(locales)) {
    const label = (ns) => JSON.parse(fs.readFileSync(path.join(locales, language, `${ns}.json`), "utf8")).tabLabel;
    const popup = await context.newPage();
    await popup.addInitScript((code) => localStorage.setItem("hoverTranslatePopupLanguage", code), language);
    await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);
    for (const ns of ["settings", "customize", "dictionary", "about"]) {
      await expect(popup.getByRole("tab", { name: label(ns), exact: true })).toBeVisible();
    }
    await expect(popup.locator(".MuiSkeleton-root")).toHaveCount(0);

    const { body, tabs } = await popup.evaluate(() => ({
      body: document.body.getBoundingClientRect().width,
      tabs: [...document.querySelectorAll("[role=tab]")].map((tab) => {
        const text = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = tab.getBoundingClientRect();
        const words = range.getBoundingClientRect();
        return { label: text.data, start: words.left - box.left, end: box.right - words.right };
      }),
    }));

    const least = body < 549.5 ? 15.5 : 0;
    for (const tab of tabs) {
      if (Math.min(tab.start, tab.end) < least) misfits.push({ language, label: tab.label, body, start: tab.start, end: tab.end });
    }
    await popup.close();
  }

  expect(misfits).toEqual([]);
});
