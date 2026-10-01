const { test, expect } = require("./extension.js");

const selectedWords = (player) => player.frame.locator(".custom-tooltip-word-selected");

/** How much of `inner`'s width `outer` covers, 0 to 1. */
const horizontalOverlap = (outer, inner) =>
  Math.max(0, Math.min(outer.x + outer.width, inner.x + inner.width) - Math.max(outer.x, inner.x)) / inner.width;

/** The word the browser finds at `point`, without its separator, or null. */
const wordAt = (player, point) => player.frame.evaluate(({ x, y }) =>
  document.elementFromPoint(x, y)?.closest(".custom-tooltip-word")?.textContent.trim() ?? null, point);

/**
 * Rests the pointer near the right edge of `text`, where the line, centred
 * again as it grows, brings the next word under it.
 */
const restAtRightEdge = async (player, text) => {
  const box = await player.word(text).boundingBox();
  const point = { x: box.x + box.width - 2, y: box.y + box.height / 2 };
  await player.page.mouse.move(point.x, point.y);
  return point;
};

test.describe("into Russian", () => {
  test.beforeEach(async ({ storage }) => {
    await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ru" });
  });

  test("a Shift selection survives auto-generated captions growing word by word, onto the next line", async ({ openPlayer, network }) => {
    network.translate("ru", "what are you doing", "что ты делаешь");
    const player = await openPlayer();
    await player.captions("so what are");

    await player.word("what").hover();
    await player.page.keyboard.down("Shift");
    await player.word("are").hover();
    await expect(selectedWords(player)).toHaveText(["what ", "are"]);

    // The pointer waits above the line, Shift still down: YouTube centres the
    // growing line, and a word shifting under a resting pointer would join
    // the selection (see the tests below).
    const line = await player.frame.locator(".caption-window").boundingBox();
    await player.page.mouse.move(line.x + line.width / 2, line.y - 30);

    // The very nodes stay: a rebuilt line would drop the selection.
    await player.frame.evaluate(() => document.querySelector(".custom-tooltip-word-selected").setAttribute("data-probe", ""));
    await player.fixture("appendWord", "you");
    await expect(player.word("you")).toBeVisible();
    await expect(selectedWords(player)).toHaveText(["what ", "are "]);
    await expect(player.frame.locator("[data-probe]")).toHaveClass(/custom-tooltip-word-selected/);

    await player.fixture("appendLine", "doing");
    await player.word("you").hover();
    await player.word("doing").hover();
    await player.page.keyboard.up("Shift");

    await expect(selectedWords(player)).toHaveText(["what ", "are ", "you", "doing"]);
    await expect(player.tooltip).toHaveText("что ты делаешь");
    expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("q")).toBe("what are you doing");
  });

  // Chrome outside macOS sends the boundary events of words shifting under a
  // resting pointer without Shift (crbug.com/538289); the three tests below
  // rest the pointer where the growing line brings another word under it.
  test("Shift held, the word an auto-generated caption shifts under the resting pointer joins the selection", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions("so what are");

    await player.word("what").hover();
    await player.page.keyboard.down("Shift");
    const pointer = await restAtRightEdge(player, "are");
    await expect(selectedWords(player)).toHaveText(["what ", "are"]);
    expect(await wordAt(player, pointer)).toBe("are");

    await player.fixture("appendWord", "you");
    await expect(player.word("you")).toBeVisible();
    expect(await wordAt(player, pointer)).toBe("you");
    await expect(selectedWords(player)).toHaveText(["what ", "are ", "you"]);
  });

  test("Shift pressed after the hover, without a move, still holds the selection as the line grows", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions("so what are");

    const pointer = await restAtRightEdge(player, "what");
    await expect(selectedWords(player)).toHaveText(["what "]);
    expect(await wordAt(player, pointer)).toBe("what");
    await player.page.keyboard.down("Shift");

    await player.fixture("appendWord", "you");
    await expect(player.word("you")).toBeVisible();
    expect(await wordAt(player, pointer)).toBe("are");
    await expect(selectedWords(player)).toHaveText(["what ", "are "]);
  });

  test("a Shift the frame lost track of (the window lost focus) holds nothing", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions("so what are");

    await player.word("what").hover();
    await player.page.keyboard.down("Shift");
    const pointer = await restAtRightEdge(player, "are");
    await expect(selectedWords(player)).toHaveText(["what ", "are"]);
    // Released in another window, say after Alt+Tab: no keyup comes here.
    await player.frame.evaluate(() => window.dispatchEvent(new Event("blur")));

    await player.fixture("appendWord", "you");
    await expect(player.word("you")).toBeVisible();
    expect(await wordAt(player, pointer)).toBe("you");
    await expect(selectedWords(player)).toHaveText(["you"]);
  });

  test("auto-generated captions roll up: a selection on the line that went is dropped, and the lines drawn anew take a new one", async ({ openPlayer, network }) => {
    network.translate("ru", "doing now", "делаешь сейчас");
    const player = await openPlayer();
    await player.captions([{ lines: ["so what are", "you doing now"] }]);

    await player.word("what").hover();
    await player.page.keyboard.down("Shift");
    await player.word("are").hover();
    await expect(selectedWords(player)).toHaveText(["what ", "are "]);

    // Off the words, Shift still down, while YouTube rolls the lines up: a word
    // shifting under a resting pointer would join the selection.
    const line = await player.frame.locator(".caption-window").boundingBox();
    await player.page.mouse.move(line.x + line.width / 2, line.y - 30);
    await player.fixture("rollUp");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["you ", "doing ", "now "]);
    await expect(selectedWords(player)).toHaveCount(0);

    await player.word("doing").hover();
    await player.word("now").hover();
    await player.page.keyboard.up("Shift");
    await expect(selectedWords(player)).toHaveText(["doing ", "now "]);
    await expect(player.tooltip).toHaveText("делаешь сейчас");
  });

  test("with two caption windows the translation is shown at the window of the word", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([
      { lines: ["first speaker talks"], position: "top" },
      { lines: ["second speaker answers"] },
    ]);
    const [topWindow, bottomWindow] = await Promise.all([0, 1].map((index) => player.frame.locator(".caption-window").nth(index).boundingBox()));

    await player.word("answers").hover();
    await expect(player.tooltip).toHaveText("[ru] answers");
    const underBottom = await player.tooltip.boundingBox();
    // Above its window, which is in the lower half.
    expect(underBottom.y + underBottom.height).toBeLessThanOrEqual(bottomWindow.y);
    expect(underBottom.y).toBeGreaterThan(topWindow.y + topWindow.height);

    await player.word("talks").hover();
    await expect(player.tooltip).toHaveText("[ru] talks");
    // Below its window, which is in the upper half.
    expect((await player.tooltip.boundingBox()).y).toBeGreaterThanOrEqual(topWindow.y + topWindow.height);
  });
});

test.describe("Arabic captions into English", () => {
  test.beforeEach(async ({ storage }) => {
    await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "en" });
  });

  test("a right-to-left line: the tooltip over the word, a Shift phrase read from the right", async ({ openPlayer, network }) => {
    network.translate("en", "مرحبا", "hello");
    network.translate("en", "مرحبا بكم في", "welcome to");
    const player = await openPlayer();
    await player.captions([{ lines: ["مرحبا بكم في هذا الدرس"], dir: "rtl", lang: "ar" }]);

    // The first word of the line is its rightmost one.
    const first = player.word("مرحبا");
    const last = player.word("الدرس");
    expect((await first.boundingBox()).x).toBeGreaterThan((await last.boundingBox()).x);

    await first.hover();
    await expect(player.tooltip).toHaveText("hello");
    expect(horizontalOverlap(await player.tooltip.boundingBox(), await first.boundingBox())).toBeGreaterThanOrEqual(0.9);

    await player.page.keyboard.down("Shift");
    await player.word("بكم").hover();
    await player.word("في").hover();
    await player.page.keyboard.up("Shift");

    await expect(selectedWords(player)).toHaveText(["مرحبا ", "بكم ", "في "]);
    await expect(player.tooltip).toHaveText("welcome to");
    expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("q")).toBe("مرحبا بكم في");
    // The phrase starts at the right: the tooltip ends at the right edge of its first word.
    const tooltip = await player.tooltip.boundingBox();
    const firstBox = await first.boundingBox();
    expect(tooltip.x + tooltip.width).toBeCloseTo(firstBox.x + firstBox.width, 0);
    await expect(player.tooltip).toHaveCSS("direction", "ltr");
  });
});

test.describe("English captions into Arabic", () => {
  test.beforeEach(async ({ storage }) => {
    await storage.updateSettings({ sourceLanguageCode: "auto", targetLanguageCode: "ar" });
  });

  test("an Arabic translation reads right to left; the English page and messages stay left to right", async ({ openPlayer, network }) => {
    network.translate("ar", "library", "مكتبة.");
    const player = await openPlayer();
    await player.captions("the library opens");

    const word = player.word("library");
    await word.hover();
    await expect(player.tooltip).toHaveText("مكتبة.");
    await expect(player.tooltip).toHaveCSS("direction", "rtl");
    // A left-to-right line: the tooltip still starts at the left edge of the word.
    expect((await player.tooltip.boundingBox()).x).toBeCloseTo((await word.boundingBox()).x, 0);

    await word.click();
    await expect(player.notification).toHaveText("Translation saved");
    await expect(player.notification).toHaveCSS("direction", "ltr");
  });
});
