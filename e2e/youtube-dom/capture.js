const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

// Usage: node e2e/youtube-dom/capture.js [--video=ID] [--auto-video=ID]
//
// Takes what the end-to-end fixtures (`e2e/fixtures/`) imitate from the live
// YouTube. No extension is loaded — this is YouTube's own DOM. Writes to
// `captured/`:
// - `watch.json`, `embed.json`: the watch page, and the embedded player whose
//   controls layer (`#player-controls`) lies over the captions. For each
//   element the fixtures depend on, its chain of ancestors with their classes,
//   position, z-index, pointer-events and box; what lies on top of the
//   captions; the caption window as HTML; the buttons of the controls layer.
// - `auto.json`: how auto-generated captions change the DOM as they grow, one
//   line per mutation, over eight seconds of a video that has only those; a
//   line `"batch"` opens the mutations one call of the observer got together.
// When YouTube changes its player, run this, read `git diff
// e2e/youtube-dom/captured` and bring the fixtures in line.
//
// Needs network access to youtube.com and the browser of `npx playwright
// install chromium`. A minute or two; a page that shows no caption in two
// minutes (one load in three on 29.09.2026) is loaded again.

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
// TED, manual English captions.
const video = option("video") ?? "arj7oStGLkU";
// Only auto-generated English captions; there is speech from the first minute on.
const autoVideo = option("auto-video") ?? "15dIVxzj1tU";
const OUT = path.join(__dirname, "captured");

const BROWSER_ARGS = [
  // Without it a headless browser has `navigator.webdriver`, and YouTube
  // answers its caption requests with an empty body: the video plays, and no
  // caption ever appears (29.09.2026).
  "--disable-blink-features=AutomationControlled",
  // A desktop with a mouse: headless Chromium says it has no hover, like a
  // phone, and YouTube serves such a browser another player.
  "--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
];
// And a regular Chrome, not HeadlessChrome.
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}&hl=en&cc_load_policy=1&cc_lang_pref=en`;
// The embedded player needs a page to be embedded in: on its own, or without a
// referrer, YouTube refuses to play. This one is answered here, never fetched.
const EMBED_HOST = "https://example.com/";
const EMBED_HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>host</title><body style="margin:0">
<iframe width="960" height="540" style="position:absolute;left:20px;top:20px;border:0" allow="autoplay; encrypted-media"
  src="https://www.youtube.com/embed/${video}?autoplay=1&mute=1&cc_load_policy=1&cc_lang_pref=en&hl=en"></iframe>`;

// The player plays muted, with the captions on; true once a caption is on
// screen and no ad is.
function prepare() {
  const player = document.querySelector("video");
  if (player?.paused) {
    player.muted = true;
    player.play().catch(() => {});
  }
  const captionsButton = document.querySelector(".ytp-subtitles-button");
  if (captionsButton?.getAttribute("aria-pressed") === "false") captionsButton.click();
  return Boolean(document.querySelector(".ytp-caption-segment")?.textContent.trim())
    && !document.querySelector(".ad-showing");
}

// YouTube's elements, and what decides where the pointer goes over them; null
// between two caption lines.
function describe() {
  const segment = document.querySelector(".ytp-caption-segment");
  if (!segment?.textContent.trim()) return null;

  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height].map(Math.round);
  };
  const node = (element) => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || undefined,
      class: String(element.className || "") || undefined,
      style: element.getAttribute("style") || undefined,
      position: style.position,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      box: box(element),
    };
  };
  const chain = (element) => {
    const out = [];
    for (let current = element; current && current !== document.documentElement; current = current.parentElement) {
      out.push(node(current));
    }
    return out;
  };
  // The controls layer of the embedded player (`PLAYER_CONTROLS_LAYER`). The
  // watch page has other `#player-controls`, in its thumbnail previews.
  const controls = document.querySelector(".ytPlayerControlsContainerHost");
  const [left, top, width, height] = box(segment);
  const onTop = document.elementsFromPoint(left + width / 2, top + height / 2);

  return {
    url: location.origin + location.pathname,
    // From the caption segment up to the body: the captions and the player around them.
    captionChain: chain(segment),
    captionWindowHtml: document.querySelector(".caption-window").outerHTML,
    video: node(document.querySelector("video")),
    playerChildren: Array.from(document.querySelector(".html5-video-player").children).map(node),
    // Top to bottom, over the middle of the caption line.
    onTopOfCaption: onTop.slice(0, 8).map(node),
    // The layer: from the element over the caption up to it, then up to the body.
    controlsChain: controls && chain(onTop[0].closest(".ytPlayerControlsContainerHost") ? onTop[0] : controls),
    // What in the layer takes a click: the player's buttons and sliders.
    controlsButtons: controls && Array.from(controls.querySelectorAll("button, [role=button], [role=slider], a[href]"))
      .filter((element) => element.getBoundingClientRect().width > 0)
      .map((element) => ({ ...node(element), label: element.getAttribute("aria-label") ?? undefined, role: element.getAttribute("role") ?? undefined })),
  };
}

// `frame.waitForFunction` never resolved in the cross-origin frame of the
// embedded player, where `evaluate` of the same function did; polled instead.
async function until(frame, fn, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const value = await frame.evaluate(fn);
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`${fn.name}: nothing in ${timeoutMs / 1000} s at ${frame.url()}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function capturePage(context, name) {
  const page = await context.newPage();
  try {
    await page.goto(name === "watch" ? watchUrl(video) : EMBED_HOST);
    const player = name === "watch"
      ? page.mainFrame()
      : await (await page.waitForSelector("iframe")).contentFrame();

    await until(player, prepare, 120_000);
    // The controls of the embedded player come up under a moving mouse.
    await page.mouse.move(300, 200);
    await page.mouse.move(310, 210);
    await page.waitForTimeout(500);

    return await until(player, describe, 60_000);
  } finally {
    await page.close();
  }
}

// The mutations of the caption container, as one line each, e.g.
// `childList span.ytp-caption-segment +[#text(" still")] -[]`. Each call of
// the observer starts with a line `"batch"`: what the extension's observer
// gets in one call is all it sees at once.
function recordMutations() {
  const describeNode = (node) => (node.nodeType === Node.TEXT_NODE
    ? `#text(${JSON.stringify(node.textContent)})`
    : `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0]}`);
  window.captionMutations = [];
  new MutationObserver((records) => {
    window.captionMutations.push("batch");
    for (const record of records) {
      window.captionMutations.push(`${record.type} ${describeNode(record.target)} `
        + `+[${Array.from(record.addedNodes, describeNode).join(", ")}] -[${Array.from(record.removedNodes, describeNode).join(", ")}]`);
    }
  }).observe(document.querySelector(".ytp-caption-window-container"), { childList: true, subtree: true, characterData: true });
}

async function captureGrowth(context) {
  const page = await context.newPage();
  try {
    await page.goto(watchUrl(autoVideo));
    await until(page.mainFrame(), prepare, 120_000);
    await page.evaluate(() => {
      document.querySelector("video").currentTime = 90;
    });
    await until(page.mainFrame(), prepare, 60_000);
    await page.evaluate(recordMutations);
    await page.waitForTimeout(8000);
    return { mutations: await page.evaluate(() => window.captionMutations) };
  } finally {
    await page.close();
  }
}

// YouTube now and then shows no caption at all on a page load.
async function retry(fn, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`${error.message}; trying again`);
    }
  }
}

async function main() {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: BROWSER_ARGS,
    userAgent: USER_AGENT,
    locale: "en-US",
    viewport: { width: 1280, height: 800 },
  });

  try {
    const capturedAt = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(OUT, { recursive: true });

    await context.route(EMBED_HOST, (route) => route.fulfill({ contentType: "text/html", body: EMBED_HOST_PAGE }));

    const write = (name, data) => fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify({ capturedAt, ...data }, null, 2)}\n`);

    for (const name of ["watch", "embed"]) {
      write(name, { video, ...await retry(() => capturePage(context, name)) });
    }
    write("auto", { video: autoVideo, ...await retry(() => captureGrowth(context)) });

    console.log(`Written to ${path.relative(process.cwd(), OUT)}/: watch.json, embed.json, auto.json (${capturedAt})`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
