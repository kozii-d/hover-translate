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

  it("punctuation joins a word instead of standing alone", () => {
    expect(splitIntoWords("你好，世界。")).toEqual([
      { text: "你好", separator: "" },
      { text: "，世界", separator: "。" },
    ]);
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

  it("a chunk of punctuation alone stays whole", () => {
    expect(splitIntoWords("「」")).toEqual([{ text: "「」", separator: " " }]);
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

    expect(split("我喜欢看视频")).toEqual([{ text: "我喜欢看视频", separator: " " }]);
    expect(split("Hello world")).toEqual([{ text: "Hello", separator: " " }, { text: "world", separator: " " }]);
  });
});
