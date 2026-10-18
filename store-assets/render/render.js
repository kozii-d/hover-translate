const path = require("node:path");
const fs = require("node:fs");
const { SETS, SHOTS, SHOT_ORDER, scene, storeShots } = require("./sets.js");
const { HEADLINES, NOTES, AUTOPAUSE_NOTES, AMO_CAPTIONS, CREDITS } = require("./strings.js");
const { PALETTES } = require("./palettes.js");
const youtube = require("./youtube.js");
const { withRetries, deeplKey } = youtube;
const { openComposer, composeScreenshot, composePromo } = require("./compose.js");

// Usage: node store-assets/render/render.js [--sets=en,ru] [--shots=word,phrase] [--parallel=3] [--compose-only]
//
// Two steps. Capture: the built extension (`npm run build` first) on the live
// YouTube, one frame of the player per shot — needs the network, and DeepL's
// shot reads DEEPL_API_KEY from the root `.env`. Compose: each frame as a store
// screenshot in every palette, and on black without text for AMO (English
// only: AMO takes one set). `--compose-only` lays out the frames captured
// before. The sets are captured `--parallel` at a time, each in a browser of
// its own. Writes to store-assets/out/ (not in git), a folder per store:
//   chrome/<set>/<palette>/<n>-<shot>.png  Chrome's five, numbered in the order of upload
//   edge/<set>/<palette>/<n>-<shot>.png    Edge's six
//   amo/<n>-<shot>.png, amo/captions.txt   AMO's seven (one set, English) and their captions by listing language
//   promo/<set>/tile.png, marquee.png      the small promo tile, 440×280, and the marquee, 1400×560
//                                          (Chrome takes one of each for every language: en's)
//   capture/<set>/                         the frames from the player and the popup, for --compose-only
// and the site's link preview, cut as the marquee, into docs/ (in git):
//   media/og.jpg                           1200×630, English only, as the site

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "store-assets/out");
const CAPTURE = path.join(OUT, "capture");

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3).split(",");

/**
 * The browser of a set: its language, DeepL with the key from `.env`. The
 * language translated from is set per shot (`captureShot`).
 */
function launchSet(setName) {
  const set = SETS[setName];
  return youtube.launch({
    uiLanguage: set.ui,
    settings: { translator: "deepl", sourceLanguageCode: set.captions, targetLanguageCode: set.target, autoPause: true },
    apiKeys: { deepl: deeplKey() },
  });
}

const playerFrame = (setName, shotName) => path.join(CAPTURE, setName, `${shotName}.png`);
// What the tooltip in the frame said, kept next to it.
const playerTooltip = (setName, shotName) => path.join(CAPTURE, setName, `${shotName}.txt`);
const POPUP_THEMES = ["light", "dark"];
// AMO takes one set of screenshots for every language, without headlines, the
// popup in it dark (on black).
const AMO_SET = "en";
const popupFrame = (setName, shotName, theme) => path.join(CAPTURE, setName, `${shotName}-${theme}.png`);

/** Every shot of a set in one browser, one page each; a shot that fails gets a fresh browser. */
async function captureSet(setName, shots) {
  let browser = await launchSet(setName);
  try {
    for (const shotName of shots) {
      await withRetries(async (attempt) => {
        if (attempt > 1) {
          await browser.close();
          browser = await launchSet(setName);
        }
        await captureShot(browser, setName, shotName);
      }, `${setName} ${shotName}`);
    }
  } finally {
    await browser.close();
  }
}

async function captureShot(browser, setName, shotName) {
  if (shotName === "settings") return setName === AMO_SET && captureSettings(browser, setName);
  const set = SETS[setName];
  const shot = scene(setName, shotName);
  // From the language of the captions, not "auto": DeepL takes a word alone
  // for another language ("blade" for Danish).
  await youtube.updateSettings(browser.worker, { sourceLanguageCode: shot.captions });
  const page = await browser.context.newPage();
  try {
    if (shotName === "dictionary") return await captureDictionary(browser, page, setName, shot);
    const ad = await youtube.openVideo(page, { video: shot.video, time: shot.time, captions: shot.captions, youtubeLanguage: set.youtube, controls: shot.playing });
    await youtube.trackMouse(page);
    await (shot.playing ? youtube.hoverWhilePlaying(page, shot) : youtube.hover(page, shot)).catch(async (error) => {
      await page.screenshot({ path: path.join(CAPTURE, `failed-${setName}-${shotName}.png`) });
      throw error;
    });
    await youtube.drawCursor(page, await youtube.mousePosition(page));
    await youtube.shootPlayer(page, playerFrame(setName, shotName));
    const tooltip = (await page.locator(".custom-tooltip").innerText()).trim();
    fs.writeFileSync(playerTooltip(setName, shotName), tooltip);
    console.log(setName, shotName, JSON.stringify(tooltip), ad ? "(after an ad)" : "");
  } finally {
    await page.close();
  }
}

/** Saves the words of the dictionary shot one by one, then shoots the popup in each theme. */
async function captureDictionary(browser, page, setName, { scenes, captions }) {
  const set = SETS[setName];
  // A failed attempt may have saved some already.
  await youtube.clearSaved(browser.worker);
  for (const shot of scenes) {
    await youtube.openVideo(page, { video: shot.video, time: shot.time, captions, youtubeLanguage: set.youtube });
    await youtube.hover(page, shot);
    await youtube.saveToDictionary(page);
  }
  await youtube.backdateSaved(browser.worker, scenes.map((shot) => shot.daysAgo));
  await youtube.openVideo(page, { ...SHOTS.dictionaryBackground, captions, youtubeLanguage: set.youtube });
  await youtube.showFrame(page, SHOTS.dictionaryBackground.frame);
  await youtube.shootPlainPlayer(page, playerFrame(setName, "dictionary"));
  const firstWord = scenes.at(-1).word ?? scenes.at(-1).from;
  for (const theme of POPUP_THEMES) {
    await youtube.shootPopup(browser.context, browser.extensionId, { theme, prepare: youtube.dictionaryPage(firstWord), file: popupFrame(setName, "dictionary", theme) });
  }
  console.log(setName, "dictionary", scenes.length, "words");
}

/** The popup's Settings page with the translators listed, for AMO alone. */
async function captureSettings(browser, setName) {
  await youtube.shootPopup(browser.context, browser.extensionId, { theme: "dark", prepare: youtube.translatorList, file: popupFrame(setName, "settings", "dark") });
  console.log(setName, "settings");
}

/** Runs `run` over `items`, `size` at a time; reports every failure, not only the first. */
async function inParallel(items, size, run) {
  const queue = [...items];
  const failures = [];
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      await run(item).catch((error) => failures.push({ item, error }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, worker));
  for (const { item, error } of failures) console.error(`${item}: ${error.message.split("\n")[0]}`);
  if (failures.length) throw new Error(`${failures.length} of ${items.length} failed`);
}

const composedName = (shotName) => `${SHOT_ORDER.indexOf(shotName) + 1}-${shotName}.png`;

/** Where the stores that take the shot want it, numbered in their order of upload. */
function storeFiles(setName, palette, shotName) {
  return Object.entries(storeShots(setName))
    .filter(([, shots]) => shots.includes(shotName))
    .map(([store, shots]) => path.join(OUT, store, setName, palette, `${shots.indexOf(shotName) + 1}-${shotName}.png`));
}

/** Lays the screenshot out for the first store that takes it and copies it to the other. */
async function composeForStores(page, setName, palette, shotName, options) {
  const [first, ...others] = storeFiles(setName, palette, shotName);
  if (!first) return;
  await composeScreenshot(page, { ...options, palette, lang: setName, out: first });
  for (const file of others) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(first, file);
  }
}

/** AMO's caption of each screenshot in every listing language, to paste by hand. */
function writeAmoCaptions() {
  const sections = Object.keys(SETS).map((setName) => [`[${setName}]`, ...SHOT_ORDER.map((shotName) => `${composedName(shotName)}: ${AMO_CAPTIONS[shotName][setName]}`)].join("\n"));
  fs.mkdirSync(path.join(OUT, "amo"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "amo", "captions.txt"), `${sections.join("\n\n")}\n`);
}

// The promo images are cut from the word shot around its tooltip, the girl's
// face above it kept.
const PROMO_FOCUS = [0.445, 0.6];
// The site's link preview is narrower for its height than the marquee: cut
// around the middle of the line of captions, so that all of it is in.
const OG_FOCUS = [0.51, 0.6];
// The site is in English only (the user's choice, 18.10.2026).
const SITE_SET = "en";

async function composePromos(page, setName) {
  const options = { shot: playerFrame(setName, "word"), headline: HEADLINES.word[setName], credit: CREDITS[scene(setName, "word").video], lang: setName };
  for (const kind of ["tile", "marquee"]) {
    await composePromo(page, { ...options, kind, focus: PROMO_FOCUS, out: path.join(OUT, "promo", setName, `${kind}.png`) });
  }
  if (setName === SITE_SET) await composePromo(page, { ...options, kind: "og", focus: OG_FOCUS, out: path.join(ROOT, "docs/media/og.jpg") });
}

async function compose(page, setName, shotName) {
  const headline = HEADLINES[shotName]?.[setName];
  const amo = path.join(OUT, "amo", composedName(shotName));
  if (shotName === "dictionary" || shotName === "settings") {
    // The popup over a frame without captions, as it opens over the video.
    const shot = playerFrame(setName, "dictionary");
    const credit = CREDITS[SHOTS.dictionaryBackground.video];
    // The dictionary's words only read in a store's carousel larger (the
    // user's choice, 18.10.2026); the settings keep the whole list of translators.
    const zoomed = shotName === "dictionary";
    for (const palette of Object.keys(PALETTES)) {
      await composeForStores(page, setName, palette, shotName, { shot, popup: popupFrame(setName, shotName, palette), zoomed, headline, credit });
    }
    if (setName === AMO_SET) {
      await composeScreenshot(page, { shot, popup: popupFrame(setName, shotName, "dark"), zoomed, headline: "", credit, variant: "plain", lang: setName, out: amo });
    }
    return;
  }
  const shot = playerFrame(setName, shotName);
  const credit = CREDITS[scene(setName, shotName).video];
  const whole = Boolean(scene(setName, shotName).playing);
  // On AMO the caption below tells what the note does here.
  const noteText = NOTES[shotName]?.[setName];
  const note = shotName === "autopause"
    ? { text: AUTOPAUSE_NOTES[setName] }
    : noteText && { ...noteText, good: fs.readFileSync(playerTooltip(setName, shotName), "utf8") };
  for (const palette of Object.keys(PALETTES)) {
    await composeForStores(page, setName, palette, shotName, { shot, whole, headline, note, credit });
  }
  if (setName === AMO_SET) {
    await composeScreenshot(page, { shot, headline: "", credit, variant: "plain", lang: setName, out: amo });
  }
}

(async () => {
  const sets = option("sets") ?? Object.keys(SETS);
  const shots = option("shots") ?? SHOT_ORDER;
  if (!process.argv.includes("--compose-only")) {
    const started = Date.now();
    await inParallel(sets, Number(option("parallel")?.[0] ?? 3), (set) => captureSet(set, shots));
    console.log(`captured in ${Math.round((Date.now() - started) / 1000)} s`);
  }
  const composer = await openComposer();
  try {
    for (const set of sets) {
      for (const shot of shots) await compose(composer.page, set, shot);
      if (shots.includes("word")) await composePromos(composer.page, set);
    }
    if (sets.includes(AMO_SET)) writeAmoCaptions();
  } finally {
    await composer.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
