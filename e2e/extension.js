const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test: base, expect, chromium } = require("@playwright/test");
const { createFakeTranslators, INVALID_DEEPL_KEY } = require("./translators.js");

// The built extension (`npm run build`) in Playwright's Chromium, a fresh
// profile for every test, and the network answered by `context.route`: the
// fixture pages at https://www.youtube.com/watch and /embed/ (the content
// script runs on *.youtube.com only), a page on another site that embeds the
// player and the translators (`translators.js`). Anything else is refused,
// and no host name resolves (`--host-resolver-rules`), so nothing leaves the
// machine — not even the Chrome Web Store tab "Rate" opens, which
// `context.route` does not see (Chromium loads the store's pages its own way):
// it gets an error page.

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");

const WATCH_URL = "https://www.youtube.com/watch?v=fixture";
const EMBED_URL = "https://www.youtube.com/embed/fixture";
/** A site that embeds the player, 960×540 like the fixture's boxes. */
const EMBED_HOST_URL = "https://example.com/";
const EMBED_HOST_PAGE = `<!doctype html><meta charset="utf-8"><title>Embedding site</title><body style="margin:0">
<iframe width="960" height="540" style="position:absolute;left:20px;top:20px;border:0" allow="autoplay; fullscreen" src="${EMBED_URL}"></iframe>`;

const FIXTURE_FILES = {
  "/watch": "watch.html",
  "/__fixture/player.js": "player.js",
  "/__fixture/player.css": "player.css",
  "/__fixture/video.webm": "video.webm",
};
const CONTENT_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webm": "video/webm" };

const fixtureFile = (name) => ({
  status: 200,
  contentType: CONTENT_TYPES[path.extname(name)],
  body: fs.readFileSync(path.join(FIXTURES, name)),
});

/**
 * The built extension, copied with the Chrome manifest to a directory of its
 * own: the files the manifest refers to, and nothing else. Loading the
 * repository root itself takes Chromium some four seconds more per browser —
 * it walks the whole directory, three node_modules included.
 *
 * `grantedHosts` are moved from `optional_host_permissions` to
 * `host_permissions`, which Chromium grants on load: an optional permission is
 * asked for in a dialog that a headless browser cannot answer, and nothing
 * grants one from outside. Nothing else in the copy differs.
 */
function copyExtension(grantedHosts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ht-e2e-extension-"));
  for (const part of ["extension/dist", "popup/dist", "_locales", "assets"]) {
    fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true });
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.chrome.json"), "utf8"));
  if (grantedHosts.length) {
    manifest.host_permissions = grantedHosts;
    manifest.optional_host_permissions = manifest.optional_host_permissions.filter((host) => !grantedHosts.includes(host));
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

async function answer(route, network) {
  const request = route.request();
  const url = new URL(request.url());

  if (url.protocol === "chrome-extension:") return route.continue();

  if (url.host === "www.youtube.com") {
    const file = url.pathname.startsWith("/embed/") ? "embed.html" : FIXTURE_FILES[url.pathname];
    return route.fulfill(file ? fixtureFile(file) : { status: 404, body: "Not found" });
  }
  if (url.href === EMBED_HOST_URL) return route.fulfill({ status: 200, contentType: "text/html", body: EMBED_HOST_PAGE });

  if (network.handles(url.host)) {
    const response = await network.respond({ url, headers: request.headers(), body: request.postData() ?? "" });
    return response === "abort" ? route.abort("internetdisconnected") : route.fulfill(response);
  }

  return route.abort("blockedbyclient");
}

const WELCOME_PAGE = "/popup/dist/welcome.html";

/**
 * The welcome page the extension opens in a tab once installed
 * (`SettingsService`), which is when the install has written the settings.
 * It runs the content script on its demo player, and its language field
 * rewrites the settings: left open, it would act in the middle of a test.
 */
async function waitForWelcomePage(context) {
  const find = () => context.pages().find((page) => page.url().endsWith(WELCOME_PAGE));
  await expect.poll(() => Boolean(find()), { message: "the welcome page opened on install" }).toBe(true);
  return find();
}

async function closeWelcomePage(context) {
  await (await waitForWelcomePage(context)).close();
}

const test = base.extend({
  /** Hosts of optional permissions the extension is loaded with, granted (see `copyExtension`). */
  grantedHosts: [[], { option: true }],

  /** `true`: the welcome page opened on install stays, as `welcomePage`. */
  keepWelcomePage: [false, { option: true }],

  network: async ({}, use) => {
    await use(createFakeTranslators());
  },

  context: async ({ grantedHosts, network }, use) => {
    const extension = copyExtension(grantedHosts);
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      locale: "en-US",
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
        // What `context.route` does not answer finds no host.
        "--host-resolver-rules=MAP * ~NOTFOUND",
        // The fixture video starts by itself, without a sound.
        "--autoplay-policy=no-user-gesture-required",
        "--mute-audio",
      ],
    });
    await context.route("**/*", (route) => answer(route, network));
    await use(context);
    await context.close();
    fs.rmSync(extension, { recursive: true, force: true });
  },

  serviceWorker: async ({ context, keepWelcomePage }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    if (!keepWelcomePage) await closeWelcomePage(context);
    await use(worker);
  },

  /**
   * With `keepWelcomePage`: the welcome page, and its demo player as a
   * `Player`. The tab the install opened has to show the language field (its
   * list comes from the service worker), and is then shown again in a page of
   * Playwright's: some requests of the install's own tab went past
   * `context.route`, to no host (1 run in ~30, even after a reload).
   */
  welcomePage: async ({ context, serviceWorker }, use) => {
    const opened = await waitForWelcomePage(context);
    await expect(opened.getByRole("combobox", { name: /Translate to/ }), { message: "the install's tab drew its field" }).toBeVisible();
    const page = await context.newPage();
    await page.goto(opened.url());
    await opened.close();
    await use(page);
  },

  welcomePlayer: async ({ welcomePage }, use) => {
    await use(new Player(welcomePage, welcomePage.mainFrame(), ".html5-video-player video"));
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  /** `chrome.storage`, read and written by the extension's own service worker. */
  storage: async ({ serviceWorker }, use) => {
    const get = (area, key = null) => serviceWorker.evaluate(
      ([area, key]) => chrome.storage[area].get(key).then((items) => (key === null ? items : items[key])),
      [area, key],
    );
    const set = (area, items) => serviceWorker.evaluate(([area, items]) => chrome.storage[area].set(items), [area, items]);

    await use({
      get,
      set,
      /** The settings the extension wrote on install, with `changes` on top. */
      async updateSettings(changes) {
        await expect.poll(() => get("sync", "settings"), { message: "settings written on install" }).toBeTruthy();
        await set("sync", { settings: { ...(await get("sync", "settings")), ...changes } });
      },
    });
  },

  /**
   * The watch page, playing, with `.captions()` and the rest of `window.fixture`
   * one call away. `openPlayer("embed")` opens the embedded player in a page
   * of another site instead.
   */
  openPlayer: async ({ context }, use) => {
    await use(async (kind = "watch") => {
      const page = await context.newPage();
      await page.goto(kind === "embed" ? EMBED_HOST_URL : WATCH_URL);
      const frame = kind === "embed"
        ? await (await page.waitForSelector("iframe")).contentFrame()
        : page.mainFrame();
      const player = new Player(page, frame);
      await expect.poll(() => player.isPaused(), { message: "the fixture video plays" }).toBe(false);
      if (kind === "embed") await untilFrameTakesPointer(page, frame);
      return player;
    });
  },
});

/**
 * Until the embedded player gets the mouse. The frame is from another site
 * and runs in a process of its own, and for a moment after it loads Chromium
 * still gives the mouse to the page around it: a click on a word right away
 * went, whole, to the host page's `<iframe>` element (1 full run in 3 on 4
 * CPUs). A viewer is never that quick. The pointer is moved
 * over the top left of the player, away from the captions, until the frame
 * sees it.
 */
async function untilFrameTakesPointer(page, frame) {
  await frame.evaluate(() => {
    window.pointerSeen = false;
    document.addEventListener("pointermove", () => { window.pointerSeen = true; }, { capture: true, once: true });
  });
  const box = await (await frame.frameElement()).boundingBox();
  let moves = 0;
  await expect.poll(async () => {
    moves++;
    await page.mouse.move(box.x + 30 + (moves % 2), box.y + 30);
    return frame.evaluate(() => window.pointerSeen);
  }, { message: "the embedded player gets the mouse" }).toBe(true);
}

/**
 * The player page (or frame) and what a test does with it. `video`: the
 * player's video, which the fixtures tell from a preview's by YouTube's id.
 */
class Player {
  constructor(page, frame, video = "#movie_player video") {
    this.page = page;
    this.frame = frame;
    this.video = video;
  }

  /** Shows captions (`window.fixture.captions`) and waits until the content script has split them into words. */
  async captions(windows) {
    await this.frame.evaluate((windows) => window.fixture.captions(windows), windows);
    // Visible: a word of nothing but U+200B, which styled tracks pad their lines with, has no width.
    await expect(this.frame.locator(".ytp-caption-segment .custom-tooltip-word").filter({ visible: true }).first()).toBeVisible();
  }

  /** Puts another player before this one in the document (`window.fixture.preview`). */
  preview() {
    return this.fixture("preview");
  }

  fixture(method, ...args) {
    return this.frame.evaluate(([method, args]) => window.fixture[method](...args), [method, args]);
  }

  /** The word on screen whose text, without its trailing separator, is `text` (punctuation included: `carpa.`, `!`). */
  word(text) {
    const literal = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.frame.locator(".custom-tooltip-word").filter({ hasText: new RegExp(`^\\s*${literal}\\s*$`) }).first();
  }

  /** The index of the caption window `locator` is in, in the document. */
  windowIndexOf(locator) {
    return locator.evaluate((node) => Array.from(document.querySelectorAll(".caption-window")).indexOf(node.closest(".caption-window")));
  }

  /**
   * Moves the pointer to the middle of `word`'s box, whatever is over it:
   * the point, not the element (a transparent copy of the line on top).
   */
  async pointAt(word) {
    const box = await word.boundingBox();
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  }

  get tooltip() {
    return this.frame.locator(".custom-tooltip");
  }

  get notification() {
    return this.frame.locator(".custom-notification-tooltip");
  }

  get ratingCard() {
    return this.frame.locator(".custom-rating-card");
  }

  isPaused() {
    return this.frame.evaluate((video) => document.querySelector(video).paused, this.video);
  }

  /** From now on, records the video's `play` and `pause` events for `videoEvents()`. */
  recordVideoEvents() {
    return this.frame.evaluate((selector) => {
      window.videoEvents = [];
      const video = document.querySelector(selector);
      for (const type of ["play", "pause"]) video.addEventListener(type, () => window.videoEvents.push(type));
    }, this.video);
  }

  /** The video's `play` and `pause` events since `recordVideoEvents()`, in order. */
  videoEvents() {
    return this.frame.evaluate(() => [...window.videoEvents]);
  }

  /** What reached YouTube's own handlers in the fixture: "toggle", "button:<label>". */
  youtubeEvents() {
    return this.frame.evaluate(() => [...window.fixture.events]);
  }

  /** Moves the mouse onto the video, by its left edge: away from captions, which are centred. */
  async moveAway() {
    const box = await this.frame.locator(this.video).boundingBox();
    await this.page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 5 });
  }
}

/**
 * The extension's pages opened in `page` from now on are told they have no
 * access to YouTube, as with Chrome's site access "On click". Chromium cannot
 * be made to take it away: `permissions.remove` refuses the content scripts'
 * hosts, which are required.
 */
function withoutYouTubeAccess(page) {
  return page.addInitScript(() => {
    if (!globalThis.chrome?.permissions) return;
    const contains = chrome.permissions.contains.bind(chrome.permissions);
    chrome.permissions.contains = (permissions) => (permissions.origins?.some((origin) => origin.includes("youtube.com"))
      ? Promise.resolve(false)
      : contains(permissions));
  });
}

/**
 * WCAG's contrast in the page: colours as `getComputedStyle` gives them, a
 * half-transparent one laid over what is under it, up to the page's white.
 * Background images count only as the even overlay MUI gives a raised surface
 * in the dark theme (`linear-gradient(c, c)`).
 */
function contrastInPage() {
  const parse = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(value);
    if (!match) return null;
    const [r, g, b, a = 1] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const layers = (element) => {
    const style = getComputedStyle(element);
    const own = [parse(style.backgroundColor)];
    const overlay = /^linear-gradient\((rgba?\([^)]+\)), (rgba?\([^)]+\))\)$/.exec(style.backgroundImage);
    if (overlay && overlay[1] === overlay[2]) own.push(parse(overlay[1]));
    return own.filter((color) => color && color.a > 0);
  };
  /** What is behind `element`'s own box: its ancestors' backgrounds, not its own. */
  const behind = (element) => {
    const chain = [];
    for (let node = element.parentElement; node; node = node.parentElement) chain.unshift(node);
    return chain.flatMap(layers).reduce((bottom, top) => over(top, bottom), { r: 255, g: 255, b: 255, a: 1 });
  };
  const background = (element) => layers(element).reduce((bottom, top) => over(top, bottom), behind(element));
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (foreground, back) => {
    const [light, dark] = [luminance(over(foreground, back)), luminance(back)].sort((a, b) => b - a);
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
  };
  return { parse, background, behind, ratio };
}

/** Runs `fn(tools, arg)` in the page, `tools` being `contrastInPage()`'s: an expression, as the extension's CSP allows no `new Function`. */
const inPage = (page, fn, arg) => page.evaluate(`(${fn})((${contrastInPage})(), ${JSON.stringify(arg)})`);

/**
 * Every button, link, tab, option and menu item on screen whose text has less
 * than `min` contrast with what is behind it: `{ text, ratio }`. Icons alone
 * and disabled controls are left out, as WCAG leaves them out of 4.5:1.
 * While a transition runs (a dialog fading in, colours following the theme)
 * it answers `[{ running }]` instead, for `expect.poll` to wait: halfway
 * there a colour can pass where the final one would not.
 */
function lowContrast(page, min = 4.5) {
  return inPage(page, ({ parse, background, ratio }, min) => {
    const running = document.getAnimations().filter((animation) => animation.playState === "running"
      && animation.effect?.getComputedTiming().endTime !== Infinity).length;
    if (running) return [{ running }];
    const controls = document.querySelectorAll("button, a, [role='button'], [role='link'], [role='tab'], [role='option'], [role='menuitem']");
    const found = [];
    for (const control of controls) {
      if (!control.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      if (control.matches(":disabled, [aria-disabled='true'], .Mui-disabled")) continue;
      const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      const text = walker.nextNode();
      if (!text) continue;
      const holder = text.parentElement;
      const contrast = ratio(parse(getComputedStyle(holder).color), background(holder));
      if (contrast < min) found.push({ text: control.textContent.trim(), ratio: contrast });
    }
    return found;
  }, min);
}

/**
 * The keyboard focus where it shows: on the element that has it, or on the
 * MUI control around it (a switch's input is inside the control MUI marks
 * `Mui-focusVisible`). Its outline's style and width, the contrast of its
 * colour with what is behind the element (the outline is drawn around it),
 * `clippedBy`: the ancestors whose `overflow` cuts the outline off, and
 * `field`: a text field or a list field, whose focus is its border instead.
 */
function focusOutline(page) {
  return inPage(page, ({ parse, behind, ratio }) => {
    const focused = document.activeElement;
    const element = focused.closest(".Mui-focusVisible") ?? focused;
    const style = getComputedStyle(element);
    const width = parseFloat(style.outlineWidth) || 0;
    const reach = style.outlineStyle === "none" ? 0 : width + (parseFloat(style.outlineOffset) || 0);
    const box = element.getBoundingClientRect();
    const clippedBy = [];
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(node);
      if (overflowX === "visible" && overflowY === "visible") continue;
      const outer = node.getBoundingClientRect();
      const left = outer.left + node.clientLeft;
      const top = outer.top + node.clientTop;
      const cut = Math.max(left - (box.left - reach), top - (box.top - reach),
        (box.right + reach) - (left + node.clientWidth), (box.bottom + reach) - (top + node.clientHeight));
      if (cut > 0.5) clippedBy.push(String(node.className).split(" ")[0] || node.tagName);
    }
    return {
      text: (element.textContent || focused.labels?.[0]?.textContent || focused.getAttribute("aria-label") || focused.title || "").trim(),
      field: focused.matches("input:not([type='checkbox'], [type='radio']), textarea, [role='combobox']"),
      style: style.outlineStyle,
      width,
      ratio: ratio(parse(style.outlineColor), behind(element)),
      clippedBy,
    };
  }, null);
}

// A track with colours and fonts of its own, made with an editor such as
// YTSubConverter (issue #3, live on I6xwMIUPHss, 2026-10-21): YouTube starts
// and ends every line with a transparent segment of U+200B and puts one in
// the default theme after the first; some lines it draws twice, a copy with
// transparent text, laid out in another font, over the visible one.
const PAD = { text: "\u200b", style: "color: rgba(160, 170, 180, 0); fill: rgba(160, 170, 180, 0); background: rgba(8, 8, 8, 0);" };
const BLACK_ON_WHITE = "color: rgba(0, 0, 0, 0.996); fill: rgba(0, 0, 0, 0.996); background: rgba(255, 255, 255, 0.996);";
// Letter spacing in place of the copy's other font: its words lie off the visible ones.
const TRANSPARENT_COPY = "color: rgba(255, 255, 255, 0); fill: rgba(255, 255, 255, 0); background: rgba(8, 8, 8, 0); letter-spacing: 4px;";
/** A line of such a track, for `fixture.captions`: `text` in `style`, padded as YouTube pads it. */
const styledLine = (text, style) => [PAD, { text: "\u200b" }, { text, style }, PAD];

module.exports = { test, expect, INVALID_DEEPL_KEY, copyExtension, closeWelcomePage, withoutYouTubeAccess, lowContrast, focusOutline, styledLine, BLACK_ON_WHITE, TRANSPARENT_COPY };
