const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { SETS, SITE_VIDEOS, SITE_MEDIA, scene } = require("./sets.js");
const { HEADLINES, NOTES, VIDEO_LINES, CREDITS } = require("./strings.js");
const youtube = require("./youtube.js");
const { openComposer, composeVideoStill } = require("./compose.js");

// Usage: node store-assets/render/video.js [--scenes=word,phrase] [--compose-only]
//
// The promo video, 1920×1080, no sound, in English: the scenes of the en set
// (Spanish captions, DeepL into English) between an opening and a closing
// card. Two steps, as render.js. Record: the built extension (`npm run build`
// first) on the live YouTube, each scene as it plays, through Chrome's
// screencast — needs the network and DEEPL_API_KEY in the root `.env`. Put
// together: each scene under its headline, then all of them, by ffmpeg.
// `--scenes` records only those, `--compose-only` none: the others are put
// together as recorded before. Writes to store-assets/out/ (not in git):
//   video/en.mp4                                          the video
//   capture/video/en/<scene>/frames/*.jpg, frames.json    a scene as recorded
//   capture/video/en/<scene>.png, <scene>.mp4             its still and its part
//   capture/video/en/loop/<scene>.mp4                     its part without fades
// and, in git, what the README and the site show, the player alone:
//   docs/translate.gif, dictionary.gif   the README's GIFs, 800 px wide: a word
//                                        and a phrase; saving and the word list
//   site/media/<name>.mp4, .webm, .webp  the site's videos (SITE_VIDEOS in
//                                        sets.js), 960 px wide, and their posters

const ROOT = path.resolve(__dirname, "../..");
const SET = "en";
const OUT = path.join(ROOT, "store-assets/out/capture/video", SET);
const VIDEO = path.join(ROOT, "store-assets/out/video", `${SET}.mp4`);
const FPS = 60;
// Where the player goes in the video: under the headline, as wide as it.
const SLOT = { top: 276, height: 804 };
const FADE = 0.3;
// The README's GIFs: 12 a second showed the cursor jump.
const GIF_FPS = 20;
// The site's videos play in a loop: their parts are put together again
// without fades, which would flash where a video starts over.
const LOOP = path.join(OUT, "loop");
const SITE = SITE_MEDIA;
const SITE_FPS = 30;
const SITE_WIDTH = 960;

const SCENES = ["word", "phrase", "context", "dictionary", "unspaced"];
// Saved while the dictionary scene is recorded; the rest of the list before.
// A bright moment of Sprite Fright: a night scene of Sintel was all but black.
const SAVED_LIVE = "nueva";

const sceneDir = (name) => path.join(OUT, name);

/**
 * Records `page` through Chrome's screencast into `dir` until the returned
 * function is called. A frame comes only when the page changes: each is kept
 * with the time it came, and the last lasts until the end.
 */
async function startRecording(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const client = await page.context().newCDPSession(page);
  const frames = [];
  client.on("Page.screencastFrame", ({ data, sessionId }) => {
    const file = `frames/${String(frames.length).padStart(5, "0")}.jpg`;
    frames.push({ file, time: Date.now() / 1000 });
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  // Chrome sends a frame only when the page changes, and once sent none for
  // seconds after a tooltip came (18.10.2026): a dot above the player, out of
  // the picture, changes it on every frame.
  await page.addStyleTag({ content: "#render-tick { position: fixed; left: 0; top: 0; width: 2px; height: 2px; background: #000; z-index: 2147483647; animation: render-tick 0.1s steps(2) infinite; } @keyframes render-tick { to { background: #111; } }" });
  await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { id: "render-tick" })));
  await client.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
  return async (details) => {
    await client.send("Page.stopScreencast");
    await page.evaluate(() => document.getElementById("render-tick")?.remove());
    await client.detach();
    fs.writeFileSync(path.join(dir, "frames.json"), JSON.stringify({ frames, end: Date.now() / 1000, ...details }));
  };
}

async function pointOf(page, text) {
  const index = (await youtube.wordTexts(page)).indexOf(text);
  if (index < 0) throw new Error(`No word "${text}" on screen`);
  return youtube.wordPoint(page, index);
}

/**
 * The pointer drawn and parked where it comes to the word `text` from: below
 * the captions if the word is on their last line, above otherwise, so that
 * the way there crosses no other word (a word crossed would be translated,
 * and the video paused on it).
 */
async function startPointer(page, text) {
  const player = await page.locator("#movie_player").boundingBox();
  // In first: a pointer coming onto the player lifts the captions.
  await youtube.parkPointer(page);
  await youtube.sleep(800);
  const target = await pointOf(page, text);
  const lowest = Math.max(...await page.locator(".custom-tooltip-word").evaluateAll((words) => words.map((word) => word.getBoundingClientRect().top)));
  const onLastLine = target.y > lowest;
  const parked = { x: target.x + 70, y: onLastLine ? Math.min(target.y + 230, player.y + player.height - 24) : target.y - 230 };
  await page.mouse.move(parked.x, parked.y, { steps: 10 });
  await youtube.drawCursor(page, parked, { follow: true, scale: 1.4 });
  return { player, parked };
}

/** Glides to the word `text` on screen. */
async function glideToWord(page, from, text) {
  const to = await pointOf(page, text);
  await youtube.glide(page, from, to, 550);
  return to;
}

const play = (page) => page.evaluate(() => document.querySelector("#movie_player").playVideo());
const tooltipText = async (page) => (await page.locator(".custom-tooltip").innerText()).trim();

/**
 * A scene on the player: the video opened at the shot's line, recorded from a
 * moment of it playing; `act` moves the pointer and returns what to keep.
 */
async function recordOnPlayer(browser, name, shot, act) {
  const firstWord = shot.word ?? shot.from;
  await youtube.updateSettings(browser.worker, { sourceLanguageCode: shot.captions });
  const page = await browser.context.newPage();
  try {
    await youtube.openVideo(page, { video: shot.video, time: shot.time, captions: shot.captions, youtubeLanguage: SETS[SET].youtube });
    const { player, parked } = await startPointer(page, firstWord);
    const stop = await startRecording(page, sceneDir(name));
    await play(page);
    await youtube.sleep(500);
    const details = await act(page, parked);
    await stop({ top: player.y, ...details });
    console.log(name, JSON.stringify(details));
  } finally {
    await page.close();
  }
}

const RECORD = {
  // Auto-pause shows itself: the video stops under the pointer and goes on
  // once it leaves the words.
  word: (browser) => recordOnPlayer(browser, "word", scene(SET, "word"), async (page, parked) => {
    const at = await glideToWord(page, parked, scene(SET, "word").word);
    await youtube.untilTooltipSettles(page);
    await page.waitForFunction(() => document.querySelector("video").paused);
    await youtube.sleep(2200);
    const tooltip = await tooltipText(page);
    await youtube.glide(page, at, parked);
    await page.waitForFunction(() => !document.querySelector("video").paused);
    await youtube.sleep(1500);
    return { tooltip };
  }),
  phrase: (browser) => recordOnPlayer(browser, "phrase", scene(SET, "phrase"), async (page, parked) => {
    const { from, to } = scene(SET, "phrase");
    const first = await glideToWord(page, parked, from);
    await youtube.untilTooltipSettles(page);
    await youtube.sleep(700);
    // The key left of the captions, where the eye already is.
    const captions = await page.locator(".caption-window").first().boundingBox();
    const key = { x: captions.x - 210, y: captions.y + captions.height / 2 - 40 };
    await youtube.drawKey(page, "Shift", { at: key, down: true });
    await page.keyboard.down("Shift");
    await youtube.sleep(400);
    await glideToWord(page, first, to);
    await page.keyboard.up("Shift");
    await youtube.untilTooltipSettles(page);
    await youtube.sleep(300);
    await youtube.drawKey(page, "Shift", { at: key, down: false });
    const selected = await page.locator(".custom-tooltip-word-selected").count();
    if (selected < 2) throw new Error(`Selected ${selected} words`);
    await youtube.sleep(2200);
    return { tooltip: await tooltipText(page) };
  }),
  context: (browser) => recordOnPlayer(browser, "context", scene(SET, "context"), async (page, parked) => {
    await glideToWord(page, parked, scene(SET, "context").word);
    await youtube.untilTooltipSettles(page);
    await youtube.sleep(2800);
    return { tooltip: await tooltipText(page) };
  }),
  dictionary: async (browser) => {
    await recordOnPlayer(browser, "dictionary", liveSave(), async (page, parked) => {
      await glideToWord(page, parked, SAVED_LIVE);
      await youtube.untilTooltipSettles(page);
      await youtube.sleep(600);
      await youtube.saveToDictionary(page);
      await youtube.sleep(1800);
      const tooltip = await tooltipText(page);
      // The popup opens over the last frame with a pointer of its own.
      await page.evaluate(() => document.getElementById("render-cursor").remove());
      await youtube.sleep(150);
      return { tooltip };
    });
    await recordPopup(browser);
  },
  unspaced: (browser) => recordOnPlayer(browser, "unspaced", scene(SET, "unspaced"), async (page, parked) => {
    await glideToWord(page, parked, scene(SET, "unspaced").word);
    await youtube.untilTooltipSettles(page);
    await youtube.sleep(2600);
    return { tooltip: await tooltipText(page) };
  }),
};

function liveSave() {
  const { scenes, captions } = scene(SET, "dictionary");
  return { ...scenes.find((saved) => saved.word === SAVED_LIVE), captions };
}

/** The dictionary's other words, saved by clicks as the viewer would, days back. */
async function saveTheRest(browser) {
  const { scenes, captions } = scene(SET, "dictionary");
  const rest = scenes.filter((saved) => saved.word !== SAVED_LIVE);
  await youtube.clearSaved(browser.worker);
  await youtube.updateSettings(browser.worker, { sourceLanguageCode: captions });
  const page = await browser.context.newPage();
  try {
    for (const saved of rest) {
      await youtube.openVideo(page, { video: saved.video, time: saved.time, captions, youtubeLanguage: SETS[SET].youtube });
      await youtube.hover(page, saved);
      await youtube.saveToDictionary(page);
    }
  } finally {
    await page.close();
  }
  await youtube.backdateSaved(browser.worker, rest.map((saved) => saved.daysAgo));
}

// The popup larger than it opens, so that its words read in the video:
// enlarged by ffmpeg, as CSS zoom puts the export menu off its button.
const POPUP_ZOOM = 1.3;
// The export button is an icon: found by its tooltip in the popup's language.
const EXPORT_TITLE = JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", SET, "dictionary.json"), "utf8")).actions.export.tooltip;

/** The popup's dictionary, the pointer going to export it as CSV. */
async function recordPopup(browser) {
  const page = await browser.context.newPage();
  try {
    await page.goto(`chrome-extension://${browser.extensionId}/popup/dist/index.html`);
    await page.evaluate(() => chrome.storage.sync.set({ popupTheme: "dark" }));
    await page.reload();
    await youtube.dictionaryPage(SAVED_LIVE)(page);
    const width = Math.ceil((await page.locator("body").boundingBox()).width);
    await page.setViewportSize({ width, height: 600 });
    const start = { x: width * 0.5, y: 600 * 0.75 };
    await page.mouse.move(start.x, start.y);
    await youtube.drawCursor(page, start, { follow: true, scale: 1.4 / POPUP_ZOOM });
    const stop = await startRecording(page, sceneDir("popup"));
    await youtube.sleep(600);
    const center = async (locator) => {
      const box = await locator.boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const exportButton = await center(page.getByTitle(EXPORT_TITLE));
    await youtube.glide(page, start, exportButton, 600);
    await youtube.sleep(250);
    await page.mouse.down();
    await page.mouse.up();
    const csv = page.getByRole("menuitem").filter({ hasText: "CSV" });
    await csv.waitFor();
    await youtube.sleep(500);
    await youtube.glide(page, exportButton, await center(csv), 350);
    await youtube.sleep(300);
    const download = page.waitForEvent("download");
    await page.mouse.down();
    await page.mouse.up();
    await download;
    await youtube.sleep(1200);
    await stop({ top: 0, width, height: 600 });
    console.log("popup");
  } finally {
    await page.close();
  }
}

/** ffmpeg's concat list of a recording: each frame for as long as it was on screen. */
function frameList(name) {
  const dir = sceneDir(name);
  const { frames, end, ...details } = JSON.parse(fs.readFileSync(path.join(dir, "frames.json"), "utf8"));
  const lines = ["ffconcat version 1.0"];
  frames.forEach((frame, index) => {
    lines.push(`file '${frame.file}'`, `duration ${((frames[index + 1]?.time ?? end) - frame.time).toFixed(4)}`);
  });
  // The last frame twice: the concat demuxer drops the last duration otherwise.
  lines.push(`file '${frames.at(-1).file}'`);
  fs.writeFileSync(path.join(dir, "frames.txt"), `${lines.join("\n")}\n`);
  return { list: path.join(dir, "frames.txt"), length: end - frames[0].time, last: path.join(dir, frames.at(-1).file), ...details };
}

const ENCODE = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an"];
const ffmpeg = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

const partFile = (name, loop) => path.join(loop ? LOOP : OUT, `${name}.mp4`);

/**
 * A scene's part: the recording of the player in the slot under its still,
 * faded in and out; `loop`, without fades, into LOOP.
 */
function putSceneTogether(name, { fadeOut = true, loop = false } = {}) {
  const { list, length, top } = frameList(name);
  const fades = loop ? [] : [`fade=in:st=0:d=${FADE}`, fadeOut && `fade=out:st=${(length - FADE).toFixed(3)}:d=${FADE}`].filter(Boolean);
  ffmpeg([
    "-loop", "1", "-i", path.join(OUT, `${name}.png`), "-f", "concat", "-safe", "0", "-i", list,
    "-filter_complex", [`[1:v]crop=1920:${SLOT.height}:0:${Math.round(top)},fps=${FPS}[player];[0:v][player]overlay=0:${SLOT.top}:shortest=1`, ...fades].join(","),
    "-t", length.toFixed(3), ...ENCODE, partFile(name, loop),
  ]);
}

/**
 * The second part of the dictionary scene: the popup opened over the last
 * frame, dimmed; `loop`, without the fade at the end, into LOOP.
 */
function putPopupTogether({ loop = false } = {}) {
  const player = frameList("dictionary");
  const popup = frameList("popup");
  ffmpeg([
    "-loop", "1", "-i", path.join(OUT, "dictionary.png"), "-loop", "1", "-i", player.last, "-f", "concat", "-safe", "0", "-i", popup.list,
    "-filter_complex", [
      `[1:v]crop=1920:${SLOT.height}:0:${Math.round(player.top)},eq=brightness=-0.22:saturation=0.8[dim]`,
      `[0:v][dim]overlay=0:${SLOT.top}[under]`,
      `[2:v]crop=${popup.width}:${popup.height}:0:0,scale=iw*${POPUP_ZOOM}:-2:flags=lanczos,fps=${FPS},format=rgba,fade=in:st=0:d=0.25:alpha=1[popup]`,
      [`[under][popup]overlay=W-w-96:${SLOT.top + 12}:shortest=1`, ...(loop ? [] : [`fade=out:st=${(popup.length - FADE).toFixed(3)}:d=${FADE}`])].join(","),
    ].join(";"),
    "-t", popup.length.toFixed(3), ...ENCODE, partFile("popup", loop),
  ]);
}

function putCardTogether(name, seconds) {
  ffmpeg([
    "-loop", "1", "-i", path.join(OUT, `${name}.png`),
    "-vf", `fade=in:st=0:d=${FADE},fade=out:st=${seconds - FADE}:d=${FADE}`,
    "-t", String(seconds), ...ENCODE, path.join(OUT, `${name}.mp4`),
  ]);
}

/** ffmpeg's input of the parts `parts` in `dir` one after another, listed in `dir`/`name`.txt. */
function partsInput(dir, parts, name) {
  const list = path.join(dir, `${name}.txt`);
  fs.writeFileSync(list, parts.map((part) => `file '${part}.mp4'`).join("\n"));
  return ["-f", "concat", "-safe", "0", "-i", list];
}

/** The player without the headline, `fps` frames a second, `width` wide. */
const playerAlone = (fps, width) => `crop=1920:${SLOT.height}:0:${SLOT.top},fps=${fps},scale=${width}:-1:flags=lanczos`;

/** A GIF of `parts` for the README. */
function putGifTogether(parts, file) {
  ffmpeg([
    ...partsInput(OUT, parts, path.basename(file, ".gif")),
    "-filter_complex", `${playerAlone(GIF_FPS, 800)},split[a][b];[a]palettegen=stats_mode=diff[palette];[b][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    file,
  ]);
}

/**
 * The site's video `name` of the parts `parts` without fades, as H.264 (High,
 * which every browser plays; `faststart` to play before it has all come) and
 * as VP9, and its poster: the last frame, the tooltip read, the popup open.
 * Mostly still, each is a few hundred KB at a quality the eye cannot tell
 * from the recording (the site's limit is 1.5 MB). The files are in git:
 * `bitexact` keeps WebM's random segment id out, so the same frames give the
 * same bytes.
 */
function putSiteVideoTogether(name, parts) {
  const input = partsInput(LOOP, parts, name);
  // The frames are JPEG's full range, which a video for the web is not.
  const player = `${playerAlone(SITE_FPS, SITE_WIDTH)},scale=out_range=tv`;
  const out = (extension) => path.join(SITE, `${name}.${extension}`);
  ffmpeg([...input, "-vf", player, "-c:v", "libx264", "-preset", "veryslow", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out("mp4")]);
  ffmpeg([...input, "-vf", player, "-c:v", "libvpx-vp9", "-crf", "28", "-b:v", "0", "-deadline", "good", "-cpu-used", "1", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an", "-fflags", "+bitexact", out("webm")]);
  ffmpeg(["-sseof", "-0.1", "-i", partFile(parts.at(-1), true), "-vf", player, "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", out("webp")]);
}

async function composeStills(page) {
  const lang = SET;
  await composeVideoStill(page, { kind: "card", line: VIDEO_LINES.opening, lang, out: path.join(OUT, "opening.png") });
  await composeVideoStill(page, { kind: "card", line: VIDEO_LINES.closing, credits: Object.values(CREDITS).join("\n"), lang, out: path.join(OUT, "closing.png") });
  for (const name of SCENES) {
    const shot = name === "dictionary" ? liveSave() : scene(SET, name);
    const { tooltip } = frameList(name);
    const note = NOTES[name]?.[SET] && { ...NOTES[name][SET], good: tooltip };
    await composeVideoStill(page, { kind: "scene", headline: HEADLINES[name][SET], note, credit: CREDITS[shot.video], lang, out: path.join(OUT, `${name}.png`) });
  }
}

async function record(scenes) {
  const set = SETS[SET];
  const launch = () => youtube.launch({
    uiLanguage: set.ui,
    settings: { translator: "deepl", sourceLanguageCode: set.captions, targetLanguageCode: set.target, autoPause: true },
    apiKeys: { deepl: youtube.deeplKey() },
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  for (const name of scenes) {
    await youtube.withRetries(async () => {
      const browser = await launch();
      try {
        if (name === "dictionary") await saveTheRest(browser);
        await RECORD[name](browser);
      } finally {
        await browser.close();
      }
    }, name);
  }
}

(async () => {
  const scenes = process.argv.find((arg) => arg.startsWith("--scenes="))?.slice(9).split(",") ?? SCENES;
  if (!process.argv.includes("--compose-only")) await record(scenes);
  const composer = await openComposer();
  try {
    await composeStills(composer.page);
  } finally {
    await composer.close();
  }
  putCardTogether("opening", 3);
  for (const name of SCENES) putSceneTogether(name, { fadeOut: name !== "dictionary" });
  putPopupTogether();
  putCardTogether("closing", 4);
  const parts = ["opening", ...SCENES.flatMap((name) => (name === "dictionary" ? ["dictionary", "popup"] : [name])), "closing"];
  fs.writeFileSync(path.join(OUT, "parts.txt"), parts.map((part) => `file '${part}.mp4'`).join("\n"));
  fs.mkdirSync(path.dirname(VIDEO), { recursive: true });
  ffmpeg(["-f", "concat", "-safe", "0", "-i", path.join(OUT, "parts.txt"), "-c", "copy", VIDEO]);
  console.log(VIDEO);
  putGifTogether(["word", "phrase"], path.join(ROOT, "docs/translate.gif"));
  putGifTogether(["dictionary", "popup"], path.join(ROOT, "docs/dictionary.gif"));
  fs.mkdirSync(LOOP, { recursive: true });
  fs.mkdirSync(SITE, { recursive: true });
  for (const name of new Set(Object.values(SITE_VIDEOS).flat())) {
    if (name === "popup") putPopupTogether({ loop: true });
    else putSceneTogether(name, { loop: true });
  }
  for (const [name, parts] of Object.entries(SITE_VIDEOS)) {
    putSiteVideoTogether(name, parts);
    console.log(path.join(SITE, name));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
