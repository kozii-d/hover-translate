const { test, expect } = require("./extension.js");

// The embedded player of 2026 draws its controls layer over the captions, so
// the words get no pointer events of their own: the extension hands them over
// (`coveredCaptionPointerService.ts`). The fixture sits in a frame of a page
// on another site, as on a blog that embeds a video.

test.beforeEach(async ({ storage }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
});

test("a word under the controls layer: hover translates and pauses, leaving resumes", async ({ openPlayer }) => {
  const player = await openPlayer("embed");
  await player.captions("run for your life");

  // What the browser itself would give the word: the layer.
  const word = player.word("run");
  const onTop = await word.evaluate((node) => {
    const { left, top, width, height } = node.getBoundingClientRect();
    return document.elementFromPoint(left + width / 2, top + height / 2).className;
  });
  expect(onTop).toBe("fullscreen-action-menu");

  // `force`: the layer is on top, which is the point; Playwright would wait for the word to be uncovered.
  await word.hover({ force: true });
  await expect(player.tooltip).toHaveText("бегать");
  expect(await player.isPaused()).toBe(true);

  await player.moveAway();
  await expect(player.tooltip).toHaveCount(0);
  await expect.poll(() => player.isPaused()).toBe(false);
});

test("a click on a covered word saves it and does not reach the player; a click beside it does", async ({ openPlayer, storage }) => {
  const player = await openPlayer("embed");
  await player.captions("run for your life");

  await player.word("life").click({ force: true });
  await expect(player.notification).toHaveText("Translation saved");
  await expect.poll(async () => ((await storage.get("local", "savedTranslations")) ?? []).map((entry) => entry.originalText)).toEqual(["life"]);
  expect(await player.youtubeEvents()).toEqual([]);
  expect(await player.isPaused()).toBe(true);

  // Away from the caption, on the layer: leaving the word resumes the video,
  // and the click is YouTube's own, which pauses it.
  await player.moveAway();
  await expect.poll(() => player.isPaused()).toBe(false);
  const video = await player.frame.locator("video").boundingBox();
  await player.page.mouse.click(video.x + 30, video.y + video.height / 2);
  expect(await player.youtubeEvents()).toEqual(["toggle"]);
  expect(await player.isPaused()).toBe(true);
});

test("a long notification wraps inside the embedded player, as far from its right edge as from its left", async ({ openPlayer, storage }) => {
  // Bing without access to its host: the notice that Google translates meanwhile.
  await storage.updateSettings({ translator: "bing" });
  const player = await openPlayer("embed");
  await player.captions("run for your life");

  await player.word("run").hover({ force: true });
  await expect(player.notification).toContainText("Bing needs access to www.bing.com");
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  const noticeBox = await player.notification.boundingBox();
  expect(noticeBox.x - playerBox.x).toBeCloseTo(65, 0);
  expect(playerBox.x + playerBox.width - (noticeBox.x + noticeBox.width)).toBeCloseTo(65, 0);
});

test("the player's buttons keep their clicks, also over a word", async ({ openPlayer, storage }) => {
  const player = await openPlayer("embed");
  // Under the Share button at the bottom left.
  await player.captions([{ lines: ["share this"], style: "left: 32px; margin-left: 0;" }]);
  const share = player.frame.getByRole("button", { name: "Share" });
  const shareBox = await share.boundingBox();
  const wordBox = await player.word("share").boundingBox();
  expect(wordBox.x).toBeLessThan(shareBox.x + shareBox.width);
  expect(wordBox.y + wordBox.height).toBeGreaterThan(shareBox.y);

  await share.click();
  await player.frame.getByRole("button", { name: "Pause video" }).click();

  expect(await player.youtubeEvents()).toEqual(["button:Share", "button:Pause video"]);
  await expect.poll(() => player.isPaused()).toBe(true);
  await expect(player.notification).toHaveCount(0);
  expect(await storage.get("local", "savedTranslations")).toBeUndefined();
});

test("a covered word the pointer crosses with the button held neither pauses nor resumes the video", async ({ openPlayer }) => {
  const player = await openPlayer("embed");
  await player.captions("run for your life");
  const word = await player.word("for").boundingBox();
  const frame = await (await player.frame.frameElement()).boundingBox();
  await player.recordVideoEvents();

  // Pressed on the controls layer away from the captions, over the word, and
  // released outside the player: a release on the layer would be a click
  // that toggles the video.
  await player.page.mouse.move(frame.x + 30, frame.y + 30);
  await player.page.mouse.down();
  await player.page.mouse.move(word.x + word.width / 2, word.y + word.height / 2, { steps: 5 });
  await player.page.mouse.move(frame.x - 10, frame.y + frame.height + 10, { steps: 5 });
  await player.page.mouse.up();

  expect(await player.videoEvents()).toEqual([]);
  expect(await player.youtubeEvents()).toEqual([]);

  // Without the button, the covered word pauses it again.
  await player.word("for").hover({ force: true });
  await expect.poll(() => player.isPaused()).toBe(true);
});
