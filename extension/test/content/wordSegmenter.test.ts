import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWord, splitIntoWords } from "../../src/content/utils/wordSegmenter.ts";

const rendered = (text: string) => splitIntoWords(text).map(renderWord).join("");

describe("languages written with spaces: split on whitespace, as always", () => {
  it("each word keeps its punctuation and ends with a space", () => {
    expect(splitIntoWords("Hello, well-known world!")).toEqual([
      { text: "Hello,", separator: " " },
      { text: "well-known", separator: " " },
      { text: "world!", separator: " " },
    ]);
  });

  it("Korean is written with spaces and is not segmented further", () => {
    expect(splitIntoWords("안녕하세요 세계").map(({ text }) => text)).toEqual(["안녕하세요", "세계"]);
  });

  // `。` and the CJK brackets are listed for Hangul too: Korean with them is
  // still split on whitespace alone, its last word still ends with a space.
  it("Korean with CJK punctuation is split on whitespace alone", () => {
    expect(splitIntoWords("안녕하세요。 세계")).toEqual([
      { text: "안녕하세요。", separator: " " },
      { text: "세계", separator: " " },
    ]);
  });

  it("Korean in CJK brackets keeps its particle and its space at the end of the line", () => {
    expect(splitIntoWords("《기생충》은 봤어요 《기생충》")).toEqual([
      { text: "《기생충》은", separator: " " },
      { text: "봤어요", separator: " " },
      { text: "《기생충》", separator: " " },
    ]);
  });

  // Hanja inside a Korean word does not make it a Chinese one.
  it("Korean with hanja stays one word with its space at the end of the line", () => {
    expect(splitIntoWords("대한민국(大韓民國)")).toEqual([{ text: "대한민국(大韓民國)", separator: " " }]);
  });

  // `ʼ` (the Ukrainian apostrophe), `·` (Catalan `l·l`) and combining marks
  // (Vietnamese written decomposed) are listed for Thai or Han as well as for
  // Latin.
  it("letters and marks shared with Latin keep a word whole, its punctuation and its space", () => {
    expect(splitIntoWords("бурʼян, col·legi Vie\u0323\u0302t")).toEqual([
      { text: "бурʼян,", separator: " " },
      { text: "col·legi", separator: " " },
      { text: "Vie\u0323\u0302t", separator: " " },
    ]);
  });

  it("an empty caption has no words", () => {
    expect(splitIntoWords("")).toEqual([]);
  });
});

describe("scripts without spaces: Intl.Segmenter", () => {
  it("Chinese: words with nothing between them, and no space after the last", () => {
    expect(splitIntoWords("我喜欢看视频")).toEqual([
      { text: "我", separator: "" },
      { text: "喜欢", separator: "" },
      { text: "看", separator: "" },
      { text: "视频", separator: "" },
    ]);
    // A line YouTube grows word by word must read back exactly as it was.
    expect(rendered("我喜欢看视频")).toBe("我喜欢看视频");
  });

  // Changed on purpose: the comma used to lead the next word (`，世界`), and
  // hovering `世界` translated ",мир". It belongs to the word before it.
  it("punctuation joins a word instead of standing alone: the word before it", () => {
    expect(splitIntoWords("你好，世界。")).toEqual([
      { text: "你好", separator: "，" },
      { text: "世界", separator: "。" },
    ]);
  });

  it("a full stop in the middle of a line stays with the word before it", () => {
    expect(splitIntoWords("こんにちは。ゆの")).toEqual([
      { text: "こんにちは", separator: "。" },
      { text: "ゆ", separator: "" },
      { text: "の", separator: "" },
    ]);
  });

  // An opening mark never ends a word, a closing one never starts one.
  it("an opening bracket leads the next word, a closing one stays with the word before it", () => {
    expect(splitIntoWords("彼は「はい」と言った")).toEqual([
      { text: "彼", separator: "" },
      { text: "は", separator: "" },
      { text: "「はい", separator: "」" },
      { text: "と", separator: "" },
      { text: "言", separator: "" },
      { text: "っ", separator: "" },
      { text: "た", separator: "" },
    ]);
    expect(splitIntoWords("我喜欢看《哈利波特》").slice(2)).toEqual([
      { text: "看", separator: "" },
      { text: "《哈利", separator: "" },
      { text: "波特", separator: "》" },
    ]);
  });

  it("in a run of marks, those before the opening one go back, the opening one and the rest go forward", () => {
    expect(splitIntoWords("我说：“你好”。他走了")).toEqual([
      { text: "我", separator: "" },
      { text: "说", separator: "：" },
      { text: "“你好", separator: "”。" },
      { text: "他", separator: "" },
      { text: "走了", separator: "" },
    ]);
  });

  it("marks after an opening one lead the next word with it", () => {
    expect(splitIntoWords("彼は「…はい」")).toEqual([
      { text: "彼", separator: "" },
      { text: "は", separator: "" },
      { text: "「…はい", separator: "」" },
    ]);
  });

  it("an opening mark at the end of a chunk has no next word and stays with the last one", () => {
    expect(splitIntoWords("彼は「")).toEqual([
      { text: "彼", separator: "" },
      { text: "は", separator: "「" },
    ]);
    expect(splitIntoWords("彼は「 x")[1]).toEqual({ text: "は", separator: "「 " });
  });

  it("marks at the start of a chunk, with no word before them, lead the first word", () => {
    expect(splitIntoWords("（笑）そうですね")).toEqual([
      { text: "（笑", separator: "）" },
      { text: "そうですね", separator: "" },
    ]);
    expect(splitIntoWords("。っていう")[0].text).toBe("。っていう");
  });

  // Japanese auto-generated captions bring `。` as a piece of its own: the
  // word before it must render the same once the next piece arrives.
  it("a full stop stays with its word when the line grows past it", () => {
    expect(splitIntoWords("思います。")).toEqual([
      { text: "思い", separator: "" },
      { text: "ます", separator: "。" },
    ]);
    expect(splitIntoWords("思います。はい")).toEqual([
      { text: "思い", separator: "" },
      { text: "ます", separator: "。" },
      { text: "はい", separator: "" },
    ]);
  });

  it("every character of the line is rendered once, wherever its marks go", () => {
    for (const line of ["こんにちは。ゆの", "彼は「はい」と言った", "我说：“你好”。他走了", "我喜欢看《哈利波特》",
      "（笑）そうですね", "彼は「", "彼は「…はい」", "思います。はい", "你好，世界。"]) {
      expect(rendered(line)).toBe(line);
    }
  });

  it("Japanese mixes kanji and kana", () => {
    expect(splitIntoWords("猫が好きです").map(({ text }) => text)).toEqual(["猫", "が", "好き", "です"]);
  });

  it("Thai", () => {
    expect(splitIntoWords("สวัสดีครับ").map(({ text }) => text)).toEqual(["สวัสดี", "ครับ"]);
  });

  it("a space between two chunks is real and is kept; none after the line", () => {
    expect(splitIntoWords("你好 world 世界")).toEqual([
      { text: "你好", separator: " " },
      { text: "world", separator: " " },
      { text: "世界", separator: "" },
    ]);
  });

  // Changed on purpose: like any other chunk of these scripts, punctuation
  // alone gets no space at the end of the line, only between chunks.
  it("a chunk of punctuation alone stays whole, with a space only between chunks", () => {
    expect(splitIntoWords("「」")).toEqual([{ text: "「」", separator: "" }]);
    expect(splitIntoWords("「」 x")).toEqual([{ text: "「」", separator: " " }, { text: "x", separator: " " }]);
  });

  // `。` and `、` are of the Common script, but Unicode also lists them for Han
  // and kana: a Japanese line that starts with one of them must not get a
  // space before the piece YouTube appends next.
  it("Japanese punctuation alone at the end of a line gets no space", () => {
    expect(splitIntoWords("。")).toEqual([{ text: "。", separator: "" }]);
    expect(rendered("。") + "っていう").toBe("。っていう");
  });

  it("Japanese punctuation before another chunk keeps the space", () => {
    expect(splitIntoWords("、 え")[0]).toEqual({ text: "、", separator: " " });
  });
});

describe("without Intl.Segmenter (Firefox 115–124)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a spaceless line stays one word instead of breaking", async () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    vi.resetModules();
    const { splitIntoWords: split } = await import("../../src/content/utils/wordSegmenter.ts");

    expect(split("我喜欢看视频")).toEqual([{ text: "我喜欢看视频", separator: "" }]);
    expect(split("Hello world")).toEqual([{ text: "Hello", separator: " " }, { text: "world", separator: " " }]);
    expect(split("бурʼян")).toEqual([{ text: "бурʼян", separator: " " }]);
    expect(split("《기생충》")).toEqual([{ text: "《기생충》", separator: " " }]);
  });

  it("a spaceless line grows without a space between its pieces; a real space stays", async () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    vi.resetModules();
    const { renderWord: render, splitIntoWords: split } = await import("../../src/content/utils/wordSegmenter.ts");

    expect(split("なんで暇が").map(render).join("") + "っ").toBe("なんで暇がっ");
    expect(split("日本 語")).toEqual([{ text: "日本", separator: " " }, { text: "語", separator: "" }]);
  });
});
