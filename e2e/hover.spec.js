const { test, expect } = require("./extension.js");

test.beforeEach(async ({ storage }) => {
  await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
});

test("hovering a word shows its translation above it and pauses the video; leaving resumes it", async ({ openPlayer, network }) => {
  const player = await openPlayer();
  await player.captions("run for your life");

  const word = player.word("run");
  await word.hover();

  // Google's recorded answer for "run" → ru.
  await expect(player.tooltip).toHaveText("бегать");
  await expect(word).toHaveClass(/custom-tooltip-word-selected/);
  expect(await player.isPaused()).toBe(true);

  const wordBox = await word.boundingBox();
  const tooltipBox = await player.tooltip.boundingBox();
  expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(wordBox.y);
  expect(tooltipBox.x).toBeCloseTo(wordBox.x, 0);

  const [request] = network.to("translate.googleapis.com");
  expect(Object.fromEntries(["q", "sl", "tl"].map((name) => [name, request.url.searchParams.get(name)])))
    .toEqual({ q: "run", sl: "auto", tl: "ru" });

  await player.moveAway();
  await expect(player.tooltip).toHaveCount(0);
  await expect.poll(() => player.isPaused()).toBe(false);
});

test("Shift carries the selection across words, and the phrase is translated", async ({ openPlayer, network }) => {
  const player = await openPlayer();
  network.translate("ru", "for your life", "ради своей жизни");
  await player.captions("run for your life");

  await player.word("for").hover();
  await expect(player.tooltip).toHaveText("[ru] for");

  await player.page.keyboard.down("Shift");
  await player.word("your").hover();
  await player.word("life").hover();
  await player.page.keyboard.up("Shift");

  await expect(player.tooltip).toHaveText("ради своей жизни");
  await expect(player.frame.locator(".custom-tooltip-word-selected")).toHaveText(["for ", "your ", "life"]);
});

test("with \"always multiple selection\" the selection grows without Shift", async ({ openPlayer, storage }) => {
  await storage.updateSettings({ alwaysMultipleSelection: true });
  const player = await openPlayer();
  await player.captions("run for your life");

  await player.word("run").hover();
  await player.word("for").hover();

  await expect(player.frame.locator(".custom-tooltip-word-selected")).toHaveText(["run ", "for "]);
  await expect(player.tooltip).toHaveText("[ru] run for");

  // Leaving the captions ends it.
  await player.moveAway();
  await expect(player.frame.locator(".custom-tooltip-word-selected")).toHaveCount(0);
});

test("the pointer crossing the captions with the button held neither pauses nor resumes the video", async ({ openPlayer }) => {
  const player = await openPlayer();
  await player.captions("run for your life");
  const word = await player.word("for").boundingBox();
  const playerBox = await player.frame.locator(".html5-video-player").boundingBox();
  const x = word.x + word.width / 2;
  await player.recordVideoEvents();

  // Pressed below the player, over the word, and released above the player:
  // neither end is on the video, whose click would toggle it.
  await player.page.mouse.move(x, playerBox.y + playerBox.height + 20);
  await player.page.mouse.down();
  await player.page.mouse.move(x, word.y + word.height / 2, { steps: 5 });
  await player.page.mouse.move(x, playerBox.y - 20, { steps: 5 });
  await player.page.mouse.up();

  expect(await player.videoEvents()).toEqual([]);
  expect(await player.youtubeEvents()).toEqual([]);

  // Without the button, the captions pause it again.
  await player.word("for").hover();
  await expect.poll(() => player.isPaused()).toBe(true);
});
