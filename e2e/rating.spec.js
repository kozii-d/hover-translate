const { test, expect } = require("./extension.js");

// The request for a rating on the video: with the save that brings the word
// list to ten, a week after the install. Shown, it counts as put off, as the
// popup's ✕ does: neither card for 30 days, three times at most.

const DAY = 24 * 60 * 60 * 1000;
const MONTH_AGO = Date.now() - 30 * DAY;
// The reviews page of the Chrome Web Store: the build carries the store's
// `key`, so it has the store's id.
const CHROME_WEB_STORE_REVIEWS = "https://chromewebstore.google.com/detail/jbddomeagbjjdoaehkdffdhifdhnmfic/reviews";

/**
 * The addresses the extension asks `chrome.tabs.create` to open, recorded in
 * its service worker. The tab itself gets an error page: no host resolves in
 * these tests, and the store's own redirect never runs.
 */
const openedTabs = (serviceWorker) => serviceWorker.evaluate(() => globalThis.openedTabs);

test.beforeEach(async ({ storage, serviceWorker }) => {
  await serviceWorker.evaluate(() => {
    globalThis.openedTabs = [];
    const create = chrome.tabs.create.bind(chrome.tabs);
    chrome.tabs.create = (properties) => {
      globalThis.openedTabs.push(properties.url);
      return create(properties);
    };
  });
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
  // Installed a month ago, with nine words saved.
  await expect.poll(() => storage.get("sync", "installedAt")).toBeTruthy();
  await storage.set("sync", { installedAt: MONTH_AGO, updatedAt: MONTH_AGO });
  await storage.set("local", {
    savedTranslations: Array.from({ length: 9 }, (_, index) => ({
      id: `saved-${index}`,
      originalText: `word${index}`,
      translatedText: `слово${index}`,
      sourceLanguageCode: "en",
      targetLanguageCode: "ru",
      translatorName: "Google",
      timestamp: MONTH_AGO + index,
    })),
  });
});

/**
 * Saves the tenth word. The page's own world marks the moment the card
 * appears and presses "Rate" at once, as a click meant for the word would:
 * the card has to ignore it (it arms after 800 ms).
 */
async function saveTenthWord(player) {
  await player.captions("run for your life");
  await player.frame.evaluate(() => {
    new MutationObserver((_, observer) => {
      const rate = document.querySelector(".custom-rating-card button");
      if (!rate) return;
      observer.disconnect();
      window.cardShownAt = performance.now();
      rate.click();
    }).observe(document.body, { childList: true, subtree: true });
  });
  await player.word("run").click();
  await expect(player.notification).toHaveText("Translation saved");
  await expect(player.ratingCard).toBeVisible();
}

/** Until the card takes clicks: 800 ms after it appeared, waited for as a condition of the page. */
const armed = (player) => player.frame.waitForFunction(() => performance.now() - window.cardShownAt > 850);

/**
 * Saves a word that brings the list to `savedCount` and expects no card: it
 * would come right after the save, and one more translation round trip is
 * past that moment.
 */
async function saveWithoutCard(player, storage, savedCount) {
  await player.captions("run for your life");
  await player.word("life").click();
  await expect(player.notification).toHaveText("Translation saved");
  await expect.poll(async () => (await storage.get("local", "savedTranslations")).length).toBe(savedCount);
  await player.word("for").hover();
  await expect(player.tooltip).toHaveText("[ru] for");
  await expect(player.ratingCard).toHaveCount(0);
}

/** The dismissals the card wrote once it was on screen: `count`, at a moment since `since`. */
async function expectDismissals(storage, count, since) {
  await expect.poll(async () => (await storage.get("sync", "ratingPromptDismissals"))?.count).toBe(count);
  const { lastDismissedAt } = await storage.get("sync", "ratingPromptDismissals");
  expect(lastDismissedAt).toBeGreaterThanOrEqual(since);
  expect(lastDismissedAt).toBeLessThanOrEqual(Date.now());
}

test("the tenth save shows the card; the pointer on it pauses; an early press does nothing; Rate opens the store, the video stays paused", async ({ context, openPlayer, storage, serviceWorker }) => {
  const player = await openPlayer();
  const before = Date.now();
  await saveTenthWord(player);

  // On screen, it counts as put off: the shared record, not the flag of 1.2.0.
  await expectDismissals(storage, 1, before);
  expect(await storage.get("sync", "ratingPromptVideoShown")).toBeUndefined();
  // The early press was ignored.
  expect(await storage.get("sync", "ratingPromptDone")).toBeUndefined();
  expect(await openedTabs(serviceWorker)).toEqual([]);

  // At the top right of the player, clear of the captions at the bottom.
  const card = await player.ratingCard.boundingBox();
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  expect(playerBox.x + playerBox.width - (card.x + card.width)).toBeCloseTo(16, 0);
  expect(card.y - playerBox.y).toBeCloseTo(56, 0);
  await expect(player.ratingCard).toHaveAttribute("dir", "auto");

  // Pointer off the captions: the video plays; on the card: it pauses; off it: it plays.
  await player.moveAway();
  await expect.poll(() => player.isPaused()).toBe(false);
  await player.ratingCard.hover();
  await expect.poll(() => player.isPaused()).toBe(true);
  await player.moveAway();
  await expect.poll(() => player.isPaused()).toBe(false);

  await armed(player);
  const [store] = await Promise.all([
    context.waitForEvent("page"),
    player.ratingCard.getByRole("button", { name: "Rate ★" }).click(),
  ]);
  expect(await openedTabs(serviceWorker)).toEqual([CHROME_WEB_STORE_REVIEWS]);
  await expect(player.ratingCard).toHaveCount(0);
  expect(await storage.get("sync", "ratingPromptDone")).toBe(true);
  // Paused for the viewer to come back to, not resumed by the pointer "leaving" for the new tab.
  expect(await player.isPaused()).toBe(true);
  await store.close();
});

test("shown, the card puts itself off: the next save, on a new page, shows none", async ({ openPlayer, storage }) => {
  const player = await openPlayer();
  await saveTenthWord(player);
  await expectDismissals(storage, 1, MONTH_AGO);
  await player.page.close();

  await saveWithoutCard(await openPlayer(), storage, 11);
  expect((await storage.get("sync", "ratingPromptDismissals")).count).toBe(1);
});

test("\"Not now\" removes the card and resumes the video; the request is not over", async ({ openPlayer, storage }) => {
  const player = await openPlayer();
  await saveTenthWord(player);
  await armed(player);

  await player.ratingCard.getByRole("button", { name: "Not now" }).click();
  await expect(player.ratingCard).toHaveCount(0);
  await expect.poll(() => player.isPaused()).toBe(false);
  expect(await storage.get("sync", "ratingPromptDone")).toBeUndefined();
  expect((await storage.get("sync", "ratingPromptDismissals")).count).toBe(1);
});

test("a month after it was put off the card comes back, and counts once more", async ({ openPlayer, storage }) => {
  await storage.set("sync", { ratingPromptDismissals: { count: 1, lastDismissedAt: Date.now() - 31 * DAY } });
  const player = await openPlayer();
  const before = Date.now();
  await saveTenthWord(player);
  await expectDismissals(storage, 2, before);
});

test("put off three times, the card never comes back", async ({ openPlayer, storage }) => {
  const dismissals = { count: 3, lastDismissedAt: Date.now() - 100 * DAY };
  await storage.set("sync", { ratingPromptDismissals: dismissals });
  await saveWithoutCard(await openPlayer(), storage, 10);
  expect(await storage.get("sync", "ratingPromptDismissals")).toEqual(dismissals);
});

// 1.2.0 showed the card once and set a flag, with no date: it counts as put
// off at the update to this version.
test("shown under 1.2.0 a month before the update: the card comes back as the second request", async ({ openPlayer, storage }) => {
  await storage.set("sync", { installedAt: Date.now() - 60 * DAY, updatedAt: Date.now() - 31 * DAY, ratingPromptVideoShown: true });
  const player = await openPlayer();
  const before = Date.now();
  await saveTenthWord(player);
  await expectDismissals(storage, 2, before);
  expect(await storage.get("sync", "ratingPromptVideoShown")).toBe(true);
});

test("in full screen the card moves with the player; Rate leaves full screen", async ({ context, openPlayer, serviceWorker }) => {
  const player = await openPlayer();
  await saveTenthWord(player);

  await player.frame.getByRole("button", { name: "Full screen (f)" }).click();
  await expect.poll(() => player.frame.evaluate(() => document.querySelector(".custom-rating-card")?.parentElement === document.fullscreenElement)).toBe(true);
  // The player fills the screen now, and the card is at its top right.
  const card = await player.ratingCard.boundingBox();
  const viewport = player.page.viewportSize();
  expect(viewport.width - (card.x + card.width)).toBeCloseTo(16, 0);
  expect(card.y).toBeCloseTo(56, 0);

  await armed(player);
  const [store] = await Promise.all([
    context.waitForEvent("page"),
    player.ratingCard.getByRole("button", { name: "Rate ★" }).click(),
  ]);
  expect(await openedTabs(serviceWorker)).toEqual([CHROME_WEB_STORE_REVIEWS]);
  await expect.poll(() => player.frame.evaluate(() => document.fullscreenElement)).toBeNull();
  await store.close();
});
