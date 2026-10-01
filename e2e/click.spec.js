const { test, expect } = require("./extension.js");

test.beforeEach(async ({ storage }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
});

/** The texts of the saved words, newest first. */
const savedWords = async (storage) => ((await storage.get("local", "savedTranslations")) ?? []).map((entry) => entry.originalText);

test("a click saves the word to the dictionary and says so on the video", async ({ openPlayer, storage }) => {
  const player = await openPlayer();
  await player.captions("run for your life");

  await player.word("run").click();

  await expect(player.notification).toHaveText("Translation saved");
  await expect.poll(() => storage.get("local", "savedTranslations")).toEqual([expect.objectContaining({
    originalText: "run",
    translatedText: "бегать",
    sourceLanguageCode: "en",
    targetLanguageCode: "ru",
    translatorName: "Google",
    transliteration: "begat'",
  })]);

  // The notification sits at the top left of the player.
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  const notificationBox = await player.notification.boundingBox();
  expect(notificationBox.x - playerBox.x).toBeCloseTo(65, 0);
  expect(notificationBox.y - playerBox.y).toBeCloseTo(40, 0);
});

test("on a page scrolled down and to the right, the tooltip is over its word and the notification at the top left of the visible player", async ({ openPlayer }) => {
  const player = await openPlayer();
  // Narrower than the player, so the page scrolls sideways too.
  await player.page.setViewportSize({ width: 800, height: 600 });
  await player.page.evaluate(() => window.scrollTo(60, 200));
  expect(await player.page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([60, 200]);
  await player.captions("run for your life");

  const word = player.word("run");
  await word.hover();
  await expect(player.tooltip).toHaveText("бегать");
  const wordBox = await word.boundingBox();
  const tooltipBox = await player.tooltip.boundingBox();
  expect(tooltipBox.x).toBeCloseTo(wordBox.x, 0);
  expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(wordBox.y);
  expect(wordBox.y - (tooltipBox.y + tooltipBox.height)).toBeLessThan(40);

  // The player starts above and left of the window: its visible part starts at 0, 0.
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  expect(playerBox.x).toBeLessThan(0);
  expect(playerBox.y).toBeLessThan(0);
  await word.click();
  await expect(player.notification).toHaveText("Translation saved");
  const notificationBox = await player.notification.boundingBox();
  expect(notificationBox.x).toBeCloseTo(65, 0);
  expect(notificationBox.y).toBeCloseTo(40, 0);
});

test("a long notification wraps inside the player, as far from its right edge as from its left", async ({ openPlayer, storage }) => {
  // Bing without access to its host: the notice that Google translates meanwhile.
  await storage.updateSettings({ translator: "bing" });
  const player = await openPlayer();
  await player.captions("run for your life");

  await player.word("run").hover();
  await expect(player.notification).toContainText("Bing needs access to www.bing.com");
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  const noticeBox = await player.notification.boundingBox();
  expect(noticeBox.x - playerBox.x).toBeCloseTo(65, 0);
  expect(playerBox.x + playerBox.width - (noticeBox.x + noticeBox.width)).toBeCloseTo(65, 0);

  // Wrapped: taller than a one-line notification, which keeps the width of its text.
  await player.word("run").click();
  await expect(player.notification).toHaveText("Translation saved");
  const savedBox = await player.notification.boundingBox();
  expect(noticeBox.height).toBeGreaterThan(1.5 * savedBox.height);
  expect(savedBox.width).toBeLessThan(noticeBox.width / 2);
});

test("with \"copy the translation\" a click copies it instead of saving", async ({ context, openPlayer, storage }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.youtube.com" });
  await storage.updateSettings({ leftClickAction: "copy-translation" });
  const player = await openPlayer();
  await player.captions("run for your life");

  await player.word("run").click();

  await expect(player.notification).toHaveText("Translated text copied");
  expect(await player.page.evaluate(() => navigator.clipboard.readText())).toBe("бегать");
  expect(await storage.get("local", "savedTranslations")).toBeUndefined();
});

test("right and middle clicks on a word save nothing", async ({ openPlayer, storage }) => {
  const player = await openPlayer();
  await player.captions("run for your life");

  // Saved first: the drag guard of a word never pressed would stop the other
  // buttons by chance (it measures from 0, 0), and a word the viewer saved and
  // then right-clicks is the case to cover.
  await player.word("life").click();
  await expect.poll(() => savedWords(storage)).toEqual(["life"]);
  const [{ id }] = await storage.get("local", "savedTranslations");

  await player.word("life").click({ button: "right" });
  await player.word("life").click({ button: "middle" });
  // A left click afterwards: once it is saved, anything the other two would have saved is too.
  await player.word("run").click();

  await expect.poll(() => savedWords(storage)).toEqual(["run", "life"]);
  // Not saved again, which would have replaced the entry with a new one.
  expect((await storage.get("local", "savedTranslations"))[1].id).toBe(id);
});

/**
 * Presses on `text`, moves by (dx, dy) in `steps` and releases; the point of
 * the release. The window follows the pointer, so the release is on the word
 * the drag started on.
 */
async function dragByWord(player, text, dx, dy, steps) {
  const word = await player.word(text).boundingBox();
  const x = word.x + word.width / 2;
  const y = word.y + word.height / 2;
  await player.page.mouse.move(x, y);
  await player.page.mouse.down();
  await player.page.mouse.move(x + dx, y + dy, { steps });
  await player.page.mouse.up();
  return { x: x + dx, y: y + dy };
}

// YouTube's caption window has been seen following a drag both ways (see
// `dragOn` in fixtures/player.js); the extension has to hold up under each.
for (const dragMode of ["drag and drop", "mousemove"]) {
  test.describe(`captions dragged by ${dragMode}`, () => {
    test("dragging the captions by a word does not save it", async ({ openPlayer, storage }) => {
      const player = await openPlayer();
      await player.fixture("dragOn", dragMode);
      await player.captions("run for your life");
      const captionWindow = player.frame.locator(".caption-window");
      const before = await captionWindow.boundingBox();

      const released = await dragByWord(player, "run", -100, -150, 10);

      // The window went with the mouse, and the release was on the word it started on.
      expect(before.y - (await captionWindow.boundingBox()).y).toBeGreaterThan(100);
      expect(await player.frame.evaluate(({ x, y }) => document.elementFromPoint(x, y).textContent.trim(), released)).toBe("run");
      expect(await player.youtubeEvents()).toEqual([]);

      // Not saved; a click after it saves.
      await player.word("for").click();
      await expect(player.notification).toHaveText("Translation saved");
      expect(await savedWords(storage)).toEqual(["for"]);
    });

    test("after dragging the captions to the top and clicking words, the video plays again once the pointer leaves", async ({ openPlayer, storage }) => {
      const player = await openPlayer();
      await player.fixture("dragOn", dragMode);
      await player.captions("run for your life");
      const captionWindow = player.frame.locator(".caption-window");

      await dragByWord(player, "your", 0, -300, 20);
      expect(await player.youtubeEvents()).toEqual([]);

      // In the upper half the translation goes under the captions.
      const windowBox = await captionWindow.boundingBox();
      const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
      expect(windowBox.y + windowBox.height / 2).toBeLessThan(playerBox.y + playerBox.height / 2);

      await player.word("run").click();
      await expect(player.notification).toHaveText("Translation saved");
      await player.word("life").click();
      await expect.poll(() => savedWords(storage)).toEqual(["life", "run"]);
      await expect(player.tooltip).toHaveText("[ru] life");
      expect((await player.tooltip.boundingBox()).y).toBeGreaterThan(windowBox.y + windowBox.height);
      // Held by the auto-pause while the pointer is on the captions…
      expect(await player.isPaused()).toBe(true);

      // …and handed back once it leaves.
      await player.moveAway();
      await expect.poll(() => player.isPaused()).toBe(false);
    });

    test("dragging the captions does not start the video the pointer paused", async ({ openPlayer }) => {
      const player = await openPlayer();
      await player.fixture("dragOn", dragMode);
      await player.captions("run for your life");
      await player.word("your").hover();
      await expect.poll(() => player.isPaused()).toBe(true);
      await player.recordVideoEvents();

      const released = await dragByWord(player, "your", 0, -300, 10);

      // Not even for an instant: every `play` is a moment of sound.
      expect(await player.videoEvents()).toEqual([]);
      expect(await player.isPaused()).toBe(true);

      // A drag and drop has had the pointer leave the window at its start, and
      // it is back only on the first move after the drop. A mouse makes that
      // move over the captions it was released on; `moveAway` alone jumps
      // clear of them in one step.
      await player.page.mouse.move(released.x + 1, released.y);
      await player.moveAway();
      await expect.poll(() => player.isPaused()).toBe(false);
    });
  });
}
