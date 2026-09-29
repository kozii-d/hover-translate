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
