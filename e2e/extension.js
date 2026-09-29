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

/**
 * The popup the extension opens once installed (`openPopupOnInstall`), which
 * is when the install has written the settings. Left open, its Settings page
 * reads them and may rewrite them — it moves a viewer whose DeepL it cannot
 * reach back to Google — in the middle of a test that has just set them.
 * Playwright does not list an action popup among the pages; it is closed as
 * a target over CDP.
 */
async function closeWelcomePopup(context, worker) {
  const popups = () => worker.evaluate(() => chrome.runtime.getContexts({ contextTypes: ["POPUP"] }).then((found) => found.length));
  await expect.poll(popups, { message: "the popup opened on install" }).toBe(1);

  const cdp = await context.newCDPSession(context.pages()[0]);
  const { targetInfos } = await cdp.send("Target.getTargets");
  const popup = targetInfos.find((target) => target.url.endsWith("/popup/dist/index.html"));
  await cdp.send("Target.closeTarget", { targetId: popup.targetId });
  await cdp.detach();
  await expect.poll(popups).toBe(0);
}

const test = base.extend({
  /** Hosts of optional permissions the extension is loaded with, granted (see `copyExtension`). */
  grantedHosts: [[], { option: true }],

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

  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await closeWelcomePopup(context, worker);
    await use(worker);
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
 * CPUs; notes/harness/19). A viewer is never that quick. The pointer is moved
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

/** The player page (or frame) and what a test does with it. */
class Player {
  constructor(page, frame) {
    this.page = page;
    this.frame = frame;
  }

  /** Shows captions (`window.fixture.captions`) and waits until the content script has split them into words. */
  async captions(windows) {
    await this.frame.evaluate((windows) => window.fixture.captions(windows), windows);
    await expect(this.frame.locator(".ytp-caption-segment .custom-tooltip-word").first()).toBeVisible();
  }

  fixture(method, ...args) {
    return this.frame.evaluate(([method, args]) => window.fixture[method](...args), [method, args]);
  }

  /** The word on screen whose text, without its trailing separator, is `text`. */
  word(text) {
    return this.frame.locator(".custom-tooltip-word").filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) }).first();
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
    return this.frame.evaluate(() => document.querySelector("video").paused);
  }

  /** What reached YouTube's own handlers in the fixture: "toggle", "button:<label>". */
  youtubeEvents() {
    return this.frame.evaluate(() => [...window.fixture.events]);
  }

  /** Moves the mouse onto the video, by its left edge: away from captions, which are centred. */
  async moveAway() {
    const box = await this.frame.locator("video").boundingBox();
    await this.page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 5 });
  }
}

module.exports = { test, expect, INVALID_DEEPL_KEY };
