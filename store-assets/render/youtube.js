const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("@playwright/test");
const { copyExtension, closeWelcomePopup } = require("../../e2e/extension.js");

// The built extension (`npm run build`) on the live YouTube, in Playwright's
// Chromium, as `e2e/youtube-dom/capture.js` opens it.

const BROWSER_ARGS = [
  // Without it YouTube answers the caption requests of an automated browser
  // with an empty body: the video plays, and no caption appears.
  "--disable-blink-features=AutomationControlled",
  // A desktop with a mouse: otherwise headless Chromium gets the phone player.
  "--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  // The graphics card, where there is one: headless Chromium draws on the
  // processor otherwise, and the playing video left the video's recording a
  // third of its frames short (18.10.2026).
  "--enable-gpu",
];
const ROOT = path.resolve(__dirname, "../..");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
const DEEPL_HOSTS = ["https://api-free.deepl.com/*", "https://api.deepl.com/*"];

// The player without its controls, as a viewer sees it once they fade.
const HIDE_PLAYER_CHROME = `
  .ytp-chrome-bottom, .ytp-gradient-bottom, .ytp-chrome-top, .ytp-gradient-top,
  .ytp-pause-overlay, .ytp-ce-element, .iv-branding, .ytp-watermark, .ytp-bezel-text-wrapper,
  .ytp-bezel, .ytp-paid-content-overlay, .ytp-spinner, .ytp-cards-button, .ytp-cards-teaser,
  .ytp-suggested-action { opacity: 0 !important; pointer-events: none !important; }`;

// What the page lays over the player in theatre mode: the YouTube Premium
// offer in the bottom left corner, dialogs.
const HIDE_PAGE_POPUPS = `
  ytd-popup-container, ytd-mealbar-promo-renderer, tp-yt-iron-overlay-backdrop { display: none !important; }`;

/** The DeepL key from the root `.env`, for the shots DeepL translates. */
function deeplKey() {
  const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const key = env.match(/^DEEPL_API_KEY=(.+)$/m)?.[1].trim();
  if (!key) throw new Error("No DEEPL_API_KEY in .env");
  return key;
}

/**
 * A browser with the extension in `uiLanguage` (Chrome's `--lang`, which the
 * popup follows), the extension's settings written, the welcome popup closed.
 * Its pages are `viewport` large, at `deviceScaleFactor`.
 */
async function launch({ uiLanguage, settings, apiKeys, viewport = { width: 1280, height: 720 }, deviceScaleFactor = 2, headless = !process.env.HEADED }) {
  const extension = copyExtension(DEEPL_HOSTS);
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless,
    locale: uiLanguage,
    viewport,
    deviceScaleFactor,
    userAgent: USER_AGENT,
    args: [...BROWSER_ARGS, `--lang=${uiLanguage}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    // On Linux Chromium takes its own language (chrome.i18n.getUILanguage(),
    // which the popup follows) from the environment, not from --lang.
    env: { ...process.env, LANGUAGE: uiLanguage.replace("-", "_") },
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  await closeWelcomePopup(context, worker);
  await worker.evaluate(async ({ settings, apiKeys }) => {
    const { settings: installed } = await chrome.storage.sync.get("settings");
    // No rating card, no tips: they cover what the shot shows.
    await chrome.storage.sync.set({ settings: { ...installed, ...settings }, ratingPromptDone: true, multipleSelectionTipDismissed: true, deeplTipDismissed: true });
    if (apiKeys) await chrome.storage.local.set({ apiKeys });
  }, { settings, apiKeys });

  const close = async () => {
    await context.close();
    fs.rmSync(extension, { recursive: true, force: true });
  };
  return { context, worker, extensionId: new URL(worker.url()).host, close };
}

/**
 * Theatre mode: the player as wide as the window. The cookie is not always
 * heeded (YouTube tries other layouts on some loads); then the button, as a
 * viewer would.
 */
async function theatreMode(page) {
  const fullWidth = () => page.evaluate(() => document.querySelector("#movie_player").getBoundingClientRect().width >= window.innerWidth - 1);
  for (let attempt = 0; attempt < 5 && !(await fullWidth()); attempt++) {
    await page.locator("#movie_player").hover();
    await page.locator(".ytp-size-button").first().click({ timeout: 5_000 }).catch(() => page.keyboard.press("t"));
    await page.waitForFunction(() => document.querySelector("#movie_player").getBoundingClientRect().width >= window.innerWidth - 1, null, { timeout: 3_000 }).catch(() => {});
  }
  if (!(await fullWidth())) throw new Error("Theatre mode did not turn on");
}

/**
 * The video at `time`, paused, in theatre mode, the captions of `captions` on
 * and larger, the controls hidden unless `controls`. An ad that still comes
 * is skipped or waited out; true if there was one.
 */
async function openVideo(page, { video, time, captions, youtubeLanguage, controls = false }) {
  const url = `https://www.youtube.com/watch?v=${video}&hl=${youtubeLanguage}&cc_load_policy=1&cc_lang_pref=${captions}&t=${Math.floor(time)}`;
  // Theatre mode, the way YouTube remembers a viewer's choice of it.
  await page.context().addCookies([{ name: "wide", value: "1", domain: ".youtube.com", path: "/" }]);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const player = document.querySelector("#movie_player");
    if (document.querySelector(".ad-showing")) window.__adShown = true;
    document.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button-modern")?.click();
    return player?.getPlayerState?.() === 1 && !document.querySelector(".ad-showing");
  }, null, { timeout: 120_000, polling: 500 });
  const adShown = await page.evaluate(() => Boolean(window.__adShown));
  await theatreMode(page);
  await page.addStyleTag({ content: HIDE_PAGE_POPUPS });
  if (!controls) await page.addStyleTag({ content: HIDE_PLAYER_CHROME });
  await page.evaluate(() => {
    const player = document.querySelector("#movie_player");
    player.setOption("captions", "fontSize", 3);
    player.setPlaybackQualityRange("hd1080", "hd1080");
  });
  await page.evaluate((time) => {
    const player = document.querySelector("#movie_player");
    player.seekTo(time - 1.5, true);
    player.playVideo();
  }, time);
  await page.waitForFunction(
    (time) => document.querySelector("video").currentTime >= time && document.querySelector(".ytp-caption-segment"),
    time, { timeout: 30_000 },
  );
  await page.evaluate(() => document.querySelector("#movie_player").pauseVideo());
  await parkPointer(page);
  // YouTube draws the line again after a pause, a resize or the pointer
  // coming in: wait until the words keep their places.
  await page.waitForFunction(() => {
    const words = [...document.querySelectorAll(".custom-tooltip-word")];
    const places = JSON.stringify(words.map((word) => {
      const { x, y } = word.getBoundingClientRect();
      return [Math.round(x), Math.round(y)];
    }));
    const settled = words.length > 0 && places === window.__lastWordPlaces;
    window.__lastWordPlaces = places;
    return settled;
  }, null, { polling: 700, timeout: 15_000 });
  return adShown;
}

/**
 * The pointer on the player, in its top left corner, away from the captions.
 * A pointer coming onto the player shows its controls (hidden here, but there)
 * and YouTube lifts the captions above them: the words are measured only once
 * the pointer is already in, or it lands on the line below.
 */
async function parkPointer(page) {
  const player = await page.locator("#movie_player").boundingBox();
  await page.mouse.move(player.x + 30, player.y + 30, { steps: 4 });
}

/** The text of each word on screen, without the punctuation around it. */
async function wordTexts(page) {
  return page.locator(".custom-tooltip-word").evaluateAll((words) => words.map((word) => word.textContent.trim().replace(/^\p{P}+|\p{P}+$/gu, "")));
}

/** Where the pointer goes to hover the word at `index`. */
async function wordPoint(page, index) {
  const box = await page.locator(".custom-tooltip-word").nth(index).boundingBox();
  // Low at the right edge: the arrow hangs below the line, and every letter
  // of the word stays in view. Not lower: the line moves a little as the
  // video plays, and the pointer at 0.88 fell off the word.
  return { x: box.x + box.width * 0.92, y: box.y + box.height * 0.7 };
}

async function hoverWord(page, index) {
  const { x, y } = await wordPoint(page, index);
  await page.mouse.move(x, y, { steps: 8 });
}

/** Until the tooltip shows a translation and it stops changing. */
async function untilTooltipSettles(page) {
  await page.locator(".custom-tooltip").filter({ hasText: /\S/ }).waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => {
    const text = document.querySelector(".custom-tooltip")?.textContent ?? "";
    const settled = text === window.__lastTooltipText;
    window.__lastTooltipText = text;
    return settled && text.trim().length > 0;
  }, null, { polling: 400, timeout: 20_000 });
}

/**
 * Hovers `word`, or selects `from` to `to` as a viewer does: the first word,
 * its translation, then Shift and the last word (`e2e/hover.spec.js`).
 */
async function hover(page, { word, from, to }) {
  const texts = await wordTexts(page);
  const indexOf = (text) => {
    const index = texts.indexOf(text);
    if (index < 0) throw new Error(`No word "${text}" in ${JSON.stringify(texts)}`);
    return index;
  };
  if (word) {
    await hoverWord(page, indexOf(word));
    await untilTooltipSettles(page);
    return;
  }
  const first = indexOf(from);
  const last = indexOf(to);
  // YouTube may draw the line again while the pointer crosses the player,
  // and the selection is dropped with the words it started on: then again.
  for (let attempt = 1; ; attempt++) {
    await hoverWord(page, first);
    await untilTooltipSettles(page);
    // Straight to the last word: the extension selects every word between the
    // two, and the way there touches no word outside them — going word by word
    // from the end of one line to the start of the next would cross the line.
    await page.keyboard.down("Shift");
    await hoverWord(page, last);
    await page.keyboard.up("Shift");
    await untilTooltipSettles(page);
    const selected = await page.locator(".custom-tooltip-word-selected").count();
    if (selected === last - first + 1) return;
    if (attempt === 3) throw new Error(`Selected ${selected} words of ${last - first + 1}`);
    await parkPointer(page);
  }
}

/**
 * Plays the video and hovers `word` on the line still on screen, until the
 * extension's auto-pause has stopped it and the tooltip is in.
 */
async function hoverWhilePlaying(page, shot) {
  await page.evaluate(() => document.querySelector("#movie_player").playVideo());
  await page.waitForFunction(() => !document.querySelector("video").paused);
  await hover(page, shot);
  await page.waitForFunction(() => document.querySelector("video").paused, null, { timeout: 5_000 });
}

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38"><path d="M2 2 L2 30 L9 23.5 L14 35 L19 33 L14 21.5 L23 21.5 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`;

/**
 * A large arrow cursor drawn where the mouse is: Playwright draws none.
 * Outside the player's hit testing, so the hover stays as it is. With
 * `follow`, it moves with the mouse from then on (a recording).
 */
async function drawCursor(page, { x, y }, { follow = false, scale = 1 } = {}) {
  await page.evaluate(({ x, y, svg, follow, scale }) => {
    // An <img>, not innerHTML: YouTube enforces Trusted Types.
    const cursor = document.createElement("img");
    cursor.id = "render-cursor";
    cursor.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    cursor.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:${26 * scale}px;height:${38 * scale}px`;
    const place = (x, y) => { cursor.style.transform = `translate(${x - 2 * scale}px, ${y - 2 * scale}px)`; };
    place(x, y);
    if (follow) document.addEventListener("mousemove", (event) => place(event.clientX, event.clientY), true);
    document.body.append(cursor);
    return cursor.decode();
  }, { x, y, svg: CURSOR_SVG, follow, scale });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Moves the mouse from `from` to `to` in `ms`, easing in and out, as a hand
 * does. Each step is placed by the clock, not counted: a move waits for the
 * browser, and counted steps came out slower and uneven.
 */
async function glide(page, from, to, ms = 450) {
  const start = Date.now();
  let t = 0;
  while (t < 1) {
    t = Math.min(1, (Date.now() - start) / ms);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased);
    await sleep(8);
  }
}

/** A key drawn as held down at `at` while `down`, removed after: a recording shows what the keyboard does. */
async function drawKey(page, label, { at, down }) {
  await page.evaluate(({ label, at, down }) => {
    document.getElementById("render-key")?.remove();
    if (!down) return;
    const key = document.createElement("div");
    key.id = "render-key";
    key.textContent = label;
    key.style.cssText = `position:fixed;left:${at.x}px;top:${at.y}px;z-index:2147483646;pointer-events:none;padding:10px 26px 14px;border:4px solid #fff;border-bottom-width:9px;border-radius:14px;background:rgba(15,15,15,0.85);color:#fff;font:700 40px/1 Roboto,Arial,sans-serif`;
    document.body.append(key);
  }, { label, at, down });
}

async function mousePosition(page) {
  return page.evaluate(() => window.__renderMouse);
}

async function trackMouse(page) {
  await page.evaluate(() => {
    document.addEventListener("mousemove", (event) => { window.__renderMouse = { x: event.clientX, y: event.clientY }; }, true);
  });
}

/** The player as a PNG, at the device scale. */
async function shootPlayer(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Theatre mode was on once the video opened, and YouTube left it later
  // (a frame of ja two thirds the size, 18.10.2026): fail, to be tried again.
  const box = await page.locator("#movie_player").boundingBox();
  if (box.width < page.viewportSize().width - 1) throw new Error("The player is not as wide as the window");
  // Without the bottom pixels: the page shows through a thin line there.
  await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.width, height: box.height - 2 } });
}

/** The player with no captions on it, the controls hidden too. */
async function shootPlainPlayer(page, file) {
  await page.addStyleTag({ content: ".ytp-caption-window-container { display: none !important; }" });
  await parkPointer(page);
  await shootPlayer(page, file);
}

/** Moves the paused video to `time` and waits until that frame is drawn. */
async function showFrame(page, time) {
  await page.evaluate((time) => new Promise((resolve) => {
    document.querySelector("video").addEventListener("seeked", () => requestAnimationFrame(() => setTimeout(resolve, 300)), { once: true });
    document.querySelector("#movie_player").seekTo(time, true);
  }), time);
}

/** Clicks where the pointer is — the word or the selection — and waits for "Translation saved". */
async function saveToDictionary(page) {
  await page.mouse.down();
  await page.mouse.up();
  await page.locator(".custom-notification-tooltip").waitFor({ timeout: 10_000 });
}

/** Merges `changes` into the extension's settings; the content script follows them live. */
async function updateSettings(worker, changes) {
  await worker.evaluate(async (changes) => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, ...changes } });
  }, changes);
}

/** Empties the dictionary. */
async function clearSaved(worker) {
  await worker.evaluate(() => chrome.storage.local.remove("savedTranslations"));
}

/**
 * Moves the saved words back by `daysAgo` each (in the order they were
 * saved), keeping their order within a day.
 */
async function backdateSaved(worker, daysAgo) {
  await worker.evaluate(async (daysAgo) => {
    const { savedTranslations } = await chrome.storage.local.get("savedTranslations");
    const now = Date.now();
    // The list holds the last saved first.
    const oldestFirst = [...savedTranslations].reverse();
    oldestFirst.forEach((saved, index) => {
      saved.timestamp = now - daysAgo[index] * 86_400_000 - (oldestFirst.length - index) * 60_000;
    });
    await chrome.storage.local.set({ savedTranslations });
  }, daysAgo);
}

/**
 * The popup in `theme`, opened as a tab and brought by `prepare` to what is
 * shot: as wide as the popup is in this language (`min-content`), at most
 * 600 px high, as Chrome opens it, or as high as `prepare` returns.
 */
async function shootPopup(context, extensionId, { theme, prepare, file }) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup/dist/index.html`);
  await page.evaluate((theme) => chrome.storage.sync.set({ popupTheme: theme }), theme);
  await page.reload();
  const end = await prepare(page);
  const { width } = await page.locator("body").boundingBox();
  const height = end ?? Math.min(600, await page.evaluate(() => document.body.scrollHeight));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height } });
  await page.close();
}

/** The Dictionary page, once `firstWord` is on it. */
const dictionaryPage = (firstWord) => async (page) => {
  await page.getByRole("tab").nth(2).click();
  await page.getByText(firstWord, { exact: false }).first().waitFor();
};

/**
 * The Settings page with the list of translators open, cut above the
 * Auto-pause switch: at 600 px the line under the switch was cut through.
 */
const translatorList = async (page) => {
  // The key's usage, all but covered by the list, showed as a strip of
  // letter tops under it (19.10.2026).
  const usage = page.locator(".MuiLinearProgress-root + .MuiTypography-caption");
  await usage.waitFor();
  await usage.evaluate((line) => { line.style.visibility = "hidden"; });
  await page.locator("#translator").click();
  await page.getByRole("option").nth(2).waitFor();
  // The menu fades in.
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".MuiMenu-paper")).opacity === "1");
  // In the gap between the key's card and the switch.
  return page.locator(".MuiFormControlLabel-root").first().evaluate((autoPause) => autoPause.getBoundingClientRect().top - 8);
};

// The live YouTube now and then serves a layout or a moment the script does
// not expect (an ad, theatre mode refused): a fresh browser usually gets past it.
async function withRetries(run, label, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run(attempt);
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`${label}: attempt ${attempt} failed (${error.message.split("\n")[0]}), again`);
    }
  }
}

module.exports = { withRetries, deeplKey, launch, openVideo, showFrame, hover, hoverWhilePlaying, wordTexts, wordPoint, untilTooltipSettles, parkPointer, drawCursor, glide, drawKey, sleep, trackMouse, mousePosition, shootPlayer, shootPlainPlayer, saveToDictionary, updateSettings, clearSaved, backdateSaved, shootPopup, dictionaryPage, translatorList };
