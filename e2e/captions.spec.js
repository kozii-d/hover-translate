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

/** Marks the selected spans, to tell them from spans built anew. */
const probeSelection = (player) => player.frame.evaluate(() =>
  document.querySelectorAll(".custom-tooltip-word-selected").forEach((word) => word.setAttribute("data-probe", "")));

/** Off the words, where no word shifts under the pointer. */
const moveAboveCaptions = async (player) => {
  const captions = await player.frame.locator(".caption-window").boundingBox();
  await player.page.mouse.move(captions.x + captions.width / 2, captions.y - 30);
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

  test("auto-generated captions roll up: a selection on the line that stays survives and goes on growing", async ({ openPlayer, network }) => {
    network.translate("ru", "you doing now", "ты сейчас делаешь");
    const player = await openPlayer();
    await player.captions([{ lines: ["so what are", "you doing now"] }]);

    await player.word("you").hover();
    await player.page.keyboard.down("Shift");
    await player.word("doing").hover();
    await expect(selectedWords(player)).toHaveText(["you ", "doing "]);

    const line = await player.frame.locator(".caption-window").boundingBox();
    await player.page.mouse.move(line.x + line.width / 2, line.y - 30);
    await player.fixture("rollUp");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["you ", "doing ", "now "]);
    await expect(selectedWords(player)).toHaveText(["you ", "doing "]);

    await player.word("now").hover();
    await player.page.keyboard.up("Shift");
    await expect(selectedWords(player)).toHaveText(["you ", "doing ", "now "]);
    await expect(player.tooltip).toHaveText("ты сейчас делаешь");
    expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("q")).toBe("you doing now");
  });

  test("auto-generated captions roll up under the resting pointer: the selection and its translation stay", async ({ openPlayer, network }) => {
    network.translate("ru", "you doing", "ты делаешь");
    const player = await openPlayer();
    // The line that stays is the longest, so the window keeps its width and,
    // anchored at the bottom, its last line stays where it was.
    await player.captions([{ lines: ["so what are", "you doing now"] }]);

    await player.word("you").hover();
    await player.page.keyboard.down("Shift");
    const box = await player.word("doing").boundingBox();
    const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await player.page.mouse.move(pointer.x, pointer.y);
    await expect(selectedWords(player)).toHaveText(["you ", "doing "]);
    await expect(player.tooltip).toHaveText("ты делаешь");
    expect(await wordAt(player, pointer)).toBe("doing");

    await player.fixture("rollUp");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["you ", "doing ", "now "]);
    expect(await wordAt(player, pointer)).toBe("doing");
    await expect(selectedWords(player)).toHaveText(["you ", "doing "]);
    await expect(player.tooltip).toHaveText("ты делаешь");
  });

  test("auto-generated captions roll up: a selection reaching into the line that went is dropped whole", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([{ lines: ["so what are", "you doing now"] }]);

    await player.word("are").hover();
    await player.page.keyboard.down("Shift");
    await player.word("you").hover();
    await expect(selectedWords(player)).toHaveText(["are ", "you "]);

    const line = await player.frame.locator(".caption-window").boundingBox();
    await player.page.mouse.move(line.x + line.width / 2, line.y - 30);
    await player.fixture("rollUp");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["you ", "doing ", "now "]);
    await expect(selectedWords(player)).toHaveCount(0);
  });

  // The line that went can be the start of the one that stays: the words of
  // each stay with their own line.
  for (const [line, kept] of [["stays", ["you ", "know "]], ["went", []]]) {
    test(`auto-generated captions roll up, the line that went the start of the one that stays: a selection on the line that ${line}`, async ({ openPlayer }) => {
      const player = await openPlayer();
      await player.captions([{ lines: ["you know", "you know what I mean"] }]);
      const wordOn = (text) => player.frame.locator(line === "stays" ? ".caption-visual-line:last-child" : ".caption-visual-line:first-child")
        .locator(".custom-tooltip-word").filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

      await wordOn("you").hover();
      await player.page.keyboard.down("Shift");
      await wordOn("know").hover();
      await expect(selectedWords(player)).toHaveText(["you ", "know "]);

      const captions = await player.frame.locator(".caption-window").boundingBox();
      await player.page.mouse.move(captions.x + captions.width / 2, captions.y - 30);
      await player.fixture("rollUp");
      await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["you ", "know ", "what ", "I ", "mean "]);
      await expect(selectedWords(player)).toHaveText(kept);
    });
  }

  // YouTube does not only append words: the last one can grow (a Japanese
  // word arriving in pieces, a full stop), and `Intl.Segmenter` decides the
  // end of a Japanese line anew. The spans of the words that stay, and of the
  // one that grew, are kept; the rest of the line is built again.
  test("Japanese auto-generated captions: a Shift selection survives its last word growing", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([{ lines: ["なんで暇が"], lang: "ja" }]);
    await player.fixture("appendText", "っ");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["なんで", "暇", "が", "っ"]);

    await player.word("が").hover();
    await player.page.keyboard.down("Shift");
    await player.word("っ").hover();
    await expect(selectedWords(player)).toHaveText(["が", "っ"]);

    await moveAboveCaptions(player);
    await probeSelection(player);
    await player.fixture("appendText", "て");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["なんで", "暇", "が", "って"]);
    await expect(selectedWords(player)).toHaveText(["が", "って"]);
    await expect(player.frame.locator("[data-probe]")).toHaveClass([/custom-tooltip-word-selected/, /custom-tooltip-word-selected/]);
  });

  // A line can start with `。` alone, and the next piece comes without a
  // space: nothing of ours may stand between them. The exact text, since
  // `toHaveText` collapses spaces.
  test("Japanese auto-generated captions: a piece appended to a line of punctuation alone gets no space before it", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([{ lines: ["。"], lang: "ja" }]);
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveCount(1);

    await player.fixture("appendText", "っていう");
    const segment = player.frame.locator(".ytp-caption-segment");
    await expect.poll(() => segment.evaluate((node) => ({
      text: node.textContent,
      parsed: Array.from(node.childNodes).every((child) => child.nodeType === Node.ELEMENT_NODE),
    }))).toEqual({ text: "。っていう", parsed: true });
  });

  // YouTube brings `。` as a piece of its own and the next piece after it: the
  // full stop stays with the word before it, so the selection on that word
  // reads, and is translated, as the tooltip showed it.
  test("Japanese auto-generated captions: a full stop stays with the selected word before it as the line grows", async ({ openPlayer, network }) => {
    network.translate("ru", "思います。", "Думаю.");
    const player = await openPlayer();
    await player.captions([{ lines: ["思います。"], lang: "ja" }]);

    await player.word("思い").hover();
    await player.page.keyboard.down("Shift");
    await player.word("ます。").hover();
    await expect(selectedWords(player)).toHaveText(["思い", "ます。"]);

    await moveAboveCaptions(player);
    await probeSelection(player);
    await player.fixture("appendText", "はい");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["思い", "ます。", "はい"]);
    await expect(selectedWords(player)).toHaveText(["思い", "ます。"]);
    await expect(player.frame.locator("[data-probe]")).toHaveClass([/custom-tooltip-word-selected/, /custom-tooltip-word-selected/]);

    await player.word("ます。").hover();
    await player.page.keyboard.up("Shift");
    await expect(player.tooltip).toHaveText("Думаю.");
    expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("q")).toBe("思います。");
  });

  // `今日は天気がい` + `い`: the segmenter moves a boundary back, `がい`
  // becomes `が` `いい`.
  for (const [selection, kept] of [[["今日", "は"], ["今日", "は"]], [["天気", "がい"], []]]) {
    test(`Japanese auto-generated captions, the end of the line split anew: a selection of ${selection.join("")}`, async ({ openPlayer }) => {
      const player = await openPlayer();
      await player.captions([{ lines: ["今日は天気がい"], lang: "ja" }]);
      await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["今日", "は", "天気", "がい"]);

      await player.word(selection[0]).hover();
      await player.page.keyboard.down("Shift");
      await player.word(selection[1]).hover();
      await expect(selectedWords(player)).toHaveText(selection);

      await moveAboveCaptions(player);
      await probeSelection(player);
      await player.fixture("appendText", "い");
      await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["今日", "は", "天気", "が", "いい"]);
      await expect(selectedWords(player)).toHaveText(kept);
      // A selection that reached into the end is dropped whole, not cut.
      await expect(player.frame.locator("[data-probe].custom-tooltip-word-selected")).toHaveCount(kept.length);
    });
  }

  // YouTube draws the line that stays anew, and its last word has grown:
  // `hometown` → `hometown.` on the live site (2026-10-02).
  test("auto-generated captions roll up as the last word grows: the selection on it stays and is translated with it", async ({ openPlayer, network }) => {
    network.translate("ru", "my hometown.", "мой родной город.");
    const player = await openPlayer();
    await player.captions([{ lines: ["so what are", "back in my hometown"] }]);

    await player.word("my").hover();
    await player.page.keyboard.down("Shift");
    await player.word("hometown").hover();
    await expect(selectedWords(player)).toHaveText(["my ", "hometown "]);

    await moveAboveCaptions(player);
    await probeSelection(player);
    await player.fixture("rollUp", ".");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["back ", "in ", "my ", "hometown. "]);
    await expect(selectedWords(player)).toHaveText(["my ", "hometown. "]);
    await expect(player.frame.locator("[data-probe]")).toHaveClass([/custom-tooltip-word-selected/, /custom-tooltip-word-selected/]);

    await player.word("hometown\\.").hover();
    await player.page.keyboard.up("Shift");
    await expect(player.tooltip).toHaveText("мой родной город.");
    expect(network.to("translate.googleapis.com").at(-1).url.searchParams.get("q")).toBe("my hometown.");
  });

  // On the live site (2026-10-02) the line that went started like the one
  // that stays, before its last word grew.
  test("auto-generated captions roll up, the line that went starting like the grown one that stays: the selection on the one that stays survives", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([{ lines: ["in my hometown because", "in my hometown."] }]);
    const wordOnLastLine = (text) => player.frame.locator(".caption-visual-line:last-child .custom-tooltip-word")
      .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

    await wordOnLastLine("my").hover();
    await player.page.keyboard.down("Shift");
    await wordOnLastLine("hometown\\.").hover();
    await expect(selectedWords(player)).toHaveText(["my ", "hometown. "]);

    await moveAboveCaptions(player);
    await probeSelection(player);
    await player.fixture("rollUp");
    await expect(player.frame.locator(".custom-tooltip-word")).toHaveText(["in ", "my ", "hometown. "]);
    await expect(selectedWords(player)).toHaveText(["my ", "hometown. "]);
    await expect(player.frame.locator("[data-probe]")).toHaveClass([/custom-tooltip-word-selected/, /custom-tooltip-word-selected/]);
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

  // A window given the width of another one's line moved its own line off the
  // centre YouTube had put it at.
  test("with two caption windows each one is as wide as its own line, and the line stays where YouTube centred it", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([
      { lines: ["first speaker talks"], position: "top" },
      { lines: ["second speaker answers, and much longer"] },
    ]);
    const windows = player.frame.locator(".caption-window");
    const segments = player.frame.locator(".ytp-caption-segment");

    for (const index of [0, 1]) {
      const windowBox = await windows.nth(index).boundingBox();
      const segmentBox = await segments.nth(index).boundingBox();
      expect(Math.abs(windowBox.width - segmentBox.width)).toBeLessThanOrEqual(1);
    }
    const container = await player.frame.locator(".ytp-caption-window-container").boundingBox();
    const topLine = await segments.nth(0).boundingBox();
    expect(Math.abs(topLine.x + topLine.width / 2 - (container.x + container.width / 2))).toBeLessThanOrEqual(1);
  });

  // Auto-generated captions: YouTube makes the window wider than its text,
  // and auto-pause goes by the pointer entering the window.
  test("auto-pause leaves the video playing over the empty part of a second, auto-generated caption window", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([
      { lines: ["first speaker talks"], position: "top" },
      { lines: ["second speaker"], style: "text-align: left; left: 20%; width: 560px;" },
    ]);
    const container = await player.frame.locator(".ytp-caption-window-container").boundingBox();
    const line = await player.frame.locator(".ytp-caption-segment").nth(1).boundingBox();
    const point = { x: line.x + line.width + 40, y: line.y + line.height / 2 };
    // Still inside the 560 px YouTube gave the window.
    expect(point.x).toBeLessThan(container.x + container.width * 0.2 + 560);

    await player.page.mouse.move(point.x, point.y);
    expect(await player.isPaused()).toBe(false);

    await player.word("speaker").last().hover();
    await expect.poll(() => player.isPaused()).toBe(true);
  });

  // Its lines measure 0 while it is hidden: narrowed to that, the window broke
  // its line into a word a line once shown.
  test("a caption window hidden while the others are fitted keeps its line on one line once shown", async ({ openPlayer }) => {
    const player = await openPlayer();
    await player.captions([
      { lines: ["first speaker talks"], position: "top" },
      { lines: ["second speaker answers"], style: "display: none;" },
    ]);
    await player.fixture("showHidden");

    const segments = player.frame.locator(".ytp-caption-segment");
    await expect(segments.nth(1)).toBeVisible();
    const [shown, other] = await Promise.all([1, 0].map((index) => segments.nth(index).boundingBox()));
    expect(Math.abs(shown.height - other.height)).toBeLessThanOrEqual(1);
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
