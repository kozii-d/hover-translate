const fs = require("node:fs");
const path = require("node:path");
const { test, expect, focusOutline, lowContrast, withoutYouTubeAccess } = require("./extension.js");

// The page the extension opens on install. Its demo player runs the
// extension's own content script (`welcome.html`), so these are the
// extension's hover, Shift, click and auto-pause on the page's markup: when
// that markup and `content/consts/consts.ts` part, they fail.

test.use({ keepWelcomePage: true });

const ENGLISH_LINE = ["I'm going to the beach tomorrow", "if the weather is nice"];
// Every word of it Google, asked with "auto", reads as Spanish (checked 21.10.2026).
const SPANISH_LINE = ["Caminaremos por la montaña", "cuando haga buen tiempo"];

const readLocale = (language, ns) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_locales", language, `${ns}.json`), "utf8"));

/** The demo's subtitle line, a string per visual line. */
const captionLines = (page) => page.locator(".ytp-caption-segment").allTextContents()
  .then((lines) => lines.map((line) => line.trim()));

/** Picks a language in "Translate to", as a viewer does. */
async function pickLanguage(page, search) {
  await page.getByRole("combobox", { name: /Translate to/ }).click();
  const panel = page.getByRole("dialog", { name: "Translate to" });
  await panel.getByRole("textbox").fill(search);
  await page.keyboard.press("Enter");
  await expect(panel).toHaveCount(0);
}

/** German: the line is the English one, and the fake Google answers `[de] text`. */
async function translateIntoGerman(page, storage) {
  await pickLanguage(page, "German");
  await expect.poll(() => storage.get("sync", "settings")).toMatchObject({ targetLanguageCode: "de" });
  await expect.poll(() => captionLines(page)).toEqual(ENGLISH_LINE);
  await expect(page.locator(".custom-tooltip-word").first()).toBeVisible();
}

test("the install opens the welcome page in a tab, once the settings are written", async ({ welcomePage, extensionId, storage }) => {
  expect(welcomePage.url()).toBe(`chrome-extension://${extensionId}/popup/dist/welcome.html`);
  await expect(welcomePage.getByRole("heading", { level: 1 })).toHaveText("Welcome to HoverTranslate");
  await expect(welcomePage).toHaveTitle("Welcome to HoverTranslate");
  // The icon by the title, the extension's own file, found from the built page.
  const icon = welcomePage.getByRole("heading", { level: 1 }).locator("xpath=preceding-sibling::img");
  await expect.poll(() => icon.evaluate((image) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
  // The browser is in English: so is the language to translate into.
  await expect(welcomePage.getByRole("combobox", { name: /Translate to/ })).toHaveText("English");
  expect(await storage.get("sync", "settings")).toMatchObject({ targetLanguageCode: "en" });
});

test("translated into English, the demo line is Spanish, split into words by the content script; Shift takes a phrase of it", async ({ welcomePage, welcomePlayer, network }) => {
  await expect.poll(() => captionLines(welcomePage)).toEqual(SPANISH_LINE);
  await expect(welcomePage.locator(".custom-tooltip-word")).toHaveCount(8);

  await welcomePlayer.word("la").hover();
  await expect(welcomePlayer.tooltip).toHaveText("[en] la");
  await welcomePage.keyboard.down("Shift");
  await welcomePlayer.word("montaña").hover();
  await welcomePage.keyboard.up("Shift");

  await expect(welcomePlayer.tooltip).toHaveText("[en] la montaña");
  expect(network.to("translate.googleapis.com").map((request) => request.url.searchParams.get("q"))).toEqual(["la", "la montaña"]);
});

test("a language picked in the field is saved, and the demo translates into it", async ({ welcomePage, welcomePlayer, storage, network }) => {
  await translateIntoGerman(welcomePage, storage);

  await welcomePlayer.word("beach").hover();

  await expect(welcomePlayer.tooltip).toHaveText("[de] beach");
  const [request] = network.to("translate.googleapis.com");
  expect(Object.fromEntries(["q", "tl"].map((name) => [name, request.url.searchParams.get(name)]))).toEqual({ q: "beach", tl: "de" });
});

test("Shift across two words: one request with both", async ({ welcomePage, welcomePlayer, storage, network }) => {
  await translateIntoGerman(welcomePage, storage);

  await welcomePlayer.word("the").hover();
  await expect(welcomePlayer.tooltip).toHaveText("[de] the");
  await welcomePage.keyboard.down("Shift");
  await welcomePlayer.word("beach").hover();
  await welcomePage.keyboard.up("Shift");

  await expect(welcomePlayer.tooltip).toHaveText("[de] the beach");
  expect(network.to("translate.googleapis.com").map((request) => request.url.searchParams.get("q"))).toEqual(["the", "the beach"]);
});

test("as on YouTube: a selected word is highlighted the whole height of its line, and the tooltip stays inside the player", async ({ welcomePage, welcomePlayer, storage, network }) => {
  await translateIntoGerman(welcomePage, storage);
  // A long answer, as for a phrase across both lines.
  network.translate("de", "I'm going to the beach tomorrow if the weather", "Ich gehe morgen an den Strand, wenn das Wetter mitspielt und die Sonne scheint");

  await welcomePlayer.word("I'm").hover();
  await welcomePage.keyboard.down("Shift");
  await welcomePlayer.word("weather").hover();
  await welcomePage.keyboard.up("Shift");
  await expect(welcomePlayer.tooltip).toHaveText("Ich gehe morgen an den Strand, wenn das Wetter mitspielt und die Sonne scheint");

  const heights = await welcomePage.locator(".custom-tooltip-word-selected").evaluateAll((words) => words.map((word) => ({
    word: word.getBoundingClientRect().height,
    segment: word.closest(".ytp-caption-segment").getBoundingClientRect().height / word.closest(".ytp-caption-segment").getClientRects().length,
  })));
  expect(heights).toHaveLength(9);
  for (const { word, segment } of heights) expect(word).toBeCloseTo(segment, 0);

  const video = await welcomePage.locator(".html5-video-player video").boundingBox();
  const tooltip = await welcomePlayer.tooltip.boundingBox();
  expect(tooltip.x).toBeGreaterThanOrEqual(video.x);
  expect(tooltip.y).toBeGreaterThanOrEqual(video.y);
  expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(video.x + video.width);
  expect(tooltip.y + tooltip.height).toBeLessThanOrEqual(video.y + video.height);
});

test("a click saves the word to the Dictionary and says so", async ({ welcomePage, welcomePlayer, storage }) => {
  await translateIntoGerman(welcomePage, storage);

  await welcomePlayer.word("weather").click();

  await expect(welcomePlayer.notification).toHaveText("Translation saved");
  await expect.poll(() => storage.get("local", "savedTranslations")).toEqual([expect.objectContaining({
    originalText: "weather",
    translatedText: "[de] weather",
    targetLanguageCode: "de",
  })]);
});

test("the demo video plays, stops while the pointer is on the subtitles, and goes on after; its badge and bar follow it", async ({ welcomePage, welcomePlayer }) => {
  const status = welcomePage.getByTestId("demo-status");
  const progress = () => welcomePage.getByTestId("demo-progress").evaluate((bar) => bar.getBoundingClientRect().width);
  /** Until the bar is wider than it is now: the video plays on. */
  const barGrows = async () => {
    const from = await progress();
    await expect.poll(progress, { message: "the progress bar grows" }).toBeGreaterThan(from);
  };

  await expect(welcomePage.locator(".custom-tooltip-word").first()).toBeVisible();
  await expect.poll(() => welcomePlayer.isPaused(), { message: "the demo video plays by itself" }).toBe(false);
  await expect(status).toHaveAttribute("data-state", "playing");
  await barGrows();

  await welcomePlayer.moveAway();
  await welcomePlayer.word("montaña").hover();
  await expect.poll(() => welcomePlayer.isPaused()).toBe(true);
  await expect(status).toHaveAttribute("data-state", "paused");

  await welcomePlayer.moveAway();
  await expect.poll(() => welcomePlayer.isPaused()).toBe(false);
  await expect(status).toHaveAttribute("data-state", "playing");
  await barGrows();
});

test("the language panel: no wider than the page's column in a wide window, its list scrolling inside; the whole window at 360 px", async ({ welcomePage }) => {
  const field = welcomePage.getByRole("combobox", { name: /Translate to/ });
  const panel = welcomePage.getByRole("dialog", { name: "Translate to" });
  const box = () => panel.evaluate((dialog) => {
    const { left, right, top, bottom, width, height } = dialog.getBoundingClientRect();
    const list = dialog.querySelector("[role='listbox']").parentElement;
    return { left, right, top, bottom, width, height, listScrolls: list.scrollHeight > list.clientHeight };
  });

  await welcomePage.setViewportSize({ width: 1440, height: 900 });
  await field.click();
  await expect(welcomePage.getByRole("textbox", { name: "Search languages" })).toBeFocused();
  await expect.poll(async () => (await box()).width).toBeLessThanOrEqual(720);
  const wide = await box();
  expect(Math.abs(wide.left - (1440 - wide.right))).toBeLessThanOrEqual(1);
  expect(wide.height).toBeLessThan(900);
  expect(wide.listScrolls).toBe(true);
  await welcomePage.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  await welcomePage.setViewportSize({ width: 360, height: 740 });
  await field.click();
  await expect.poll(box).toMatchObject({ left: 0, top: 0, width: 360, height: 740 });
});

test("in the dark theme the language panel in a wide window is the page's own colour, with an edge, as the popup's", async ({ welcomePage }) => {
  await welcomePage.setViewportSize({ width: 1440, height: 900 });
  await welcomePage.emulateMedia({ colorScheme: "dark" });
  await welcomePage.getByRole("combobox", { name: /Translate to/ }).click();
  const panel = welcomePage.getByRole("dialog", { name: "Translate to" });
  await expect(panel).toBeVisible();

  const look = await panel.evaluate((paper) => {
    const style = getComputedStyle(paper);
    return { background: style.backgroundColor, image: style.backgroundImage, shadow: style.boxShadow, page: getComputedStyle(document.body).backgroundColor };
  });
  // No lighter overlay of a raised surface: the selected language's tint is the popup's.
  expect(look.background).toBe(look.page);
  expect(look.image).toBe("none");
  expect(look.shadow).toMatch(/^rgba\(255, 255, 255, 0\.12\) 0px 0px 0px 1px/);
});

test("the DeepL card's button opens the popup, on its Settings page", async ({ welcomePage, serviceWorker }) => {
  const popups = () => serviceWorker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ["POPUP"] })
    .then((found) => found.map(({ documentUrl }) => documentUrl)));
  expect(await popups()).toEqual([]);

  await welcomePage.getByRole("note").getByRole("button", { name: "Open settings" }).click();

  await expect.poll(popups, { message: "the popup opened" }).toEqual([expect.stringMatching(/\/popup\/dist\/index\.html$/)]);
});

test("in another popup language: the page's own strings load next to the content script, with no errors", async ({ welcomePage }) => {
  const errors = [];
  welcomePage.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) errors.push(message.text());
  });
  welcomePage.on("pageerror", (error) => errors.push(error.message));

  await welcomePage.evaluate(() => localStorage.setItem("hoverTranslatePopupLanguage", "ru"));
  await welcomePage.reload();

  await expect(welcomePage.getByRole("heading", { level: 1 })).toHaveText(readLocale("ru", "welcome").pageTitle);
  await expect(welcomePage.getByRole("combobox", { name: new RegExp(readLocale("ru", "settings").fields.targetLanguageCode.label) }))
    .toBeVisible();
  // The content script ran in this page and put its `Headers` in place before the strings were fetched.
  expect(await welcomePage.evaluate(() => /\[native code\]/.test(String(Headers)))).toBe(false);
  await expect(welcomePage.locator(".custom-tooltip-word").first()).toBeVisible();
  expect(errors).toEqual([]);
});

// Text at least 4.5 times lighter or darker than what is behind it (WCAG AA),
// "Allow access" too; the keyboard focus an outline at least 3 times so.
for (const colorScheme of ["light", "dark"]) {
  test(`in the ${colorScheme} theme every button and link reads clearly, and the keyboard focus shows`, async ({ welcomePage }) => {
    await welcomePage.emulateMedia({ colorScheme });
    const openSettings = welcomePage.getByRole("note").getByRole("button", { name: "Open settings" });
    await expect(openSettings).toBeVisible();
    // The theme fades in.
    await expect.poll(() => lowContrast(welcomePage)).toEqual([]);

    for (let presses = 0; presses < 30 && !(await openSettings.evaluate((button) => button === document.activeElement)); presses++) {
      await welcomePage.keyboard.press("Tab");
    }
    await expect(openSettings).toBeFocused();
    const outline = await focusOutline(welcomePage);
    expect(outline.style).toBe("solid");
    expect(outline.width).toBeGreaterThan(0);
    expect(outline.ratio).toBeGreaterThanOrEqual(3);
    // Not cut off by the card's message box (`overflow`).
    expect(outline.clippedBy).toEqual([]);

    await withoutYouTubeAccess(welcomePage);
    await welcomePage.reload();
    await expect(welcomePage.getByRole("button", { name: "Allow access" })).toBeVisible();
    await expect.poll(() => lowContrast(welcomePage)).toEqual([]);
  });
}

// The title wraps between words, never inside the name, in a window as narrow
// as a phone's: there the icon stands above it, taking none of its width.
for (const language of ["en", "fi"]) {
  test(`at 360 and 375 px the title in ${language} keeps "HoverTranslate" whole`, async ({ welcomePage }) => {
    await welcomePage.evaluate((code) => localStorage.setItem("hoverTranslatePopupLanguage", code), language);
    const title = welcomePage.getByRole("heading", { level: 1 });
    for (const width of [360, 375]) {
      await welcomePage.setViewportSize({ width, height: 740 });
      await welcomePage.reload();
      await expect(title).toHaveText(readLocale(language, "welcome").pageTitle);
      const lines = await title.evaluate((heading) => {
        const text = [...heading.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.data.includes("HoverTranslate"));
        const range = document.createRange();
        const start = text.data.indexOf("HoverTranslate");
        range.setStart(text, start);
        range.setEnd(text, start + "HoverTranslate".length);
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
      });
      expect(lines, `"HoverTranslate" at ${width} px`).toBe(1);
    }
  });
}
