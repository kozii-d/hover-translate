const { test, expect } = require("./extension.js");

// The request for a rating on the video (task 08): once ever, with the save
// that brings the word list to ten, a week after the install.

const MONTH_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;
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

test("the tenth save shows the card; the pointer on it pauses; an early press does nothing; Rate opens the store, the video stays paused", async ({ context, openPlayer, storage, serviceWorker }) => {
  const player = await openPlayer();
  await saveTenthWord(player);

  // The early press was ignored.
  expect(await storage.get("sync", "ratingPromptDone")).toBeUndefined();
  expect(await storage.get("sync", "ratingPromptVideoShown")).toBe(true);
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

test("the card is shown once: the next save, on a new page, shows none", async ({ openPlayer, storage }) => {
  const player = await openPlayer();
  await saveTenthWord(player);
  await player.page.close();

  const next = await openPlayer();
  await next.captions("run for your life");
  await next.word("life").click();
  await expect(next.notification).toHaveText("Translation saved");
  await expect.poll(async () => (await storage.get("local", "savedTranslations")).length).toBe(11);
  // The card would come right after the save; one more translation round trip is past that moment.
  await next.word("for").hover();
  await expect(next.tooltip).toHaveText("[ru] for");
  await expect(next.ratingCard).toHaveCount(0);
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
