const fs = require("node:fs");
const path = require("node:path");
const { test, expect, focusOutline, lowContrast, withoutYouTubeAccess } = require("./extension.js");

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
  test(`the popup is as wide on every page, in ${language}: long words in the word list and the error screen too`, async ({ context, extensionId, storage }) => {
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

    // The error screen that replaces a page whose stored values cannot be read.
    await popup.evaluate(() => {
      for (const area of [chrome.storage.sync, chrome.storage.local]) {
        area.get = () => {
          throw new Error("The storage cannot be read");
        };
      }
    });
    const errorTitle = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_locales", language, "common.json"), "utf8")).errorState.title;
    for (const ns of ["settings", "customize", "dictionary"]) {
      await popup.getByRole("tab", { name: label(ns, "tabLabel"), exact: true }).click();
      await expect(popup.getByRole("heading", { name: label(ns, "pageTitle"), exact: true })).toBeVisible();
      await expect(popup.getByText(errorTitle, { exact: true })).toBeVisible();
      widths.push(await popup.evaluate(() => document.body.getBoundingClientRect().width));
    }

    expect(widths).toEqual(Array(8).fill(widths[0]));
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

// Text at least 4.5 times lighter or darker than what is behind it (WCAG AA),
// in both themes: the tabs, the links and the buttons of each card the
// Settings page can show — the DeepL tip, the rating card, the line about
// access to YouTube — the language panel, the confirmation of a reset and the
// About page.
for (const colorScheme of ["light", "dark"]) {
  test(`every button, link and tab reads clearly in the ${colorScheme} theme`, async ({ context, extensionId, storage }) => {
    const open = async (route = "", { youtubeAccess = true } = {}) => {
      const popup = await context.newPage();
      await popup.emulateMedia({ colorScheme });
      if (!youtubeAccess) await withoutYouTubeAccess(popup);
      await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html#${route}`);
      await expect(popup.locator(".MuiSkeleton-root")).toHaveCount(0);
      return popup;
    };
    const lowContrastOf = async (popup) => {
      await expect.poll(() => lowContrast(popup)).toEqual([]);
      // An outlined button's border is drawn in the colour of its text.
      const outlined = await popup.locator(".MuiButton-outlined").evaluateAll((buttons) => buttons.map((button) => {
        const style = getComputedStyle(button);
        return { text: button.textContent, border: style.borderTopColor, color: style.color };
      }));
      for (const { border, color } of outlined) expect(border).toBe(color);
    };

    const tips = await open();
    await expect(tips.getByRole("button", { name: "Connect DeepL" })).toBeVisible();
    await lowContrastOf(tips);
    await tips.getByRole("combobox", { name: /Translate to/ }).click();
    await expect(tips.getByRole("option", { name: "Russian", selected: true })).toBeVisible();
    await lowContrastOf(tips);
    await tips.keyboard.press("Escape");
    await tips.getByRole("button", { name: "Reset to default" }).click();
    await expect(tips.getByRole("dialog", { name: "Reset to default settings?" })).toBeVisible();
    await lowContrastOf(tips);

    const about = await open("/about");
    await expect(about.getByText("Changelog", { exact: true })).toBeVisible();
    await lowContrastOf(about);

    const noAccess = await open("", { youtubeAccess: false });
    await expect(noAccess.getByRole("button", { name: "Allow access" })).toBeVisible();
    await lowContrastOf(noAccess);

    // Installed a month ago, with ten words saved.
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await storage.set("sync", { installedAt: monthAgo, updatedAt: monthAgo });
    await storage.set("local", {
      savedTranslations: Array.from({ length: 10 }, (_, index) => ({
        id: `saved-${index}`,
        originalText: `word${index}`,
        translatedText: `слово${index}`,
        sourceLanguageCode: "en",
        targetLanguageCode: "ru",
        translatorName: "Google",
        timestamp: monthAgo + index,
      })),
    });
    const rating = await open();
    await expect(rating.getByRole("button", { name: "Rate" })).toBeVisible();
    await lowContrastOf(rating);
  });
}

// Tab through the Settings page: every stop but a field (whose focus is its
// border) shows a solid outline at least 3:1 with what is around it, not cut
// off by a box around it — a switch's, a tip's message.
for (const colorScheme of ["light", "dark"]) {
  test(`the keyboard focus shows whole on every control of Settings, in the ${colorScheme} theme`, async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.emulateMedia({ colorScheme });
    await popup.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);
    await expect(popup.getByRole("button", { name: "Connect DeepL" })).toBeVisible();
    await expect(popup.locator(".MuiSkeleton-root")).toHaveCount(0);

    const stops = [];
    for (let presses = 0; presses < 40; presses++) {
      await popup.keyboard.press("Tab");
      if (await popup.evaluate(() => document.activeElement === document.body)) break;
      stops.push(await focusOutline(popup));
    }

    const shown = stops.filter((stop) => !stop.field);
    expect(shown.map((stop) => stop.text)).toEqual(expect.arrayContaining(["Connect DeepL", "Reset to default"]));
    expect(shown.filter((stop) => stop.style !== "solid" || stop.width < 2 || stop.ratio < 3 || stop.clippedBy.length)).toEqual([]);
  });
}
