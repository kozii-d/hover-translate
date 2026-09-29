import { describe, expect, it } from "vitest";
import {
  findClosestLanguage,
  findUserLanguage,
  isSameLanguage,
  matchSelectedLanguages,
} from "../../src/common/translators/findClosestLanguage.ts";
import { fromDeepLCode } from "../../src/common/translators/deepl/deepl.ts";
import googleLanguages from "../../src/common/translators/google/availableLanguages.json";
import { DEEPL_SOURCE_LANGUAGES, DEEPL_TARGET_LANGUAGES } from "../fakeNetwork.ts";
import { AvailableLanguages } from "../../src/common/types/languages.ts";

const deeplLanguages: AvailableLanguages = {
  sourceLanguages: DEEPL_SOURCE_LANGUAGES.map((code) => ({ code: fromDeepLCode(code), name: code })),
  targetLanguages: DEEPL_TARGET_LANGUAGES.map((code) => ({ code: fromDeepLCode(code), name: code })),
};
const codes = (list: { code: string }[]) => list.map(({ code }) => code);

// The UI language the browser reports → the target language picked on install.
const GOOGLE_TABLE: [string, string][] = [
  ["en-US", "en"], ["en-GB", "en"], ["en", "en"],
  ["pt-BR", "pt"], ["pt-PT", "pt"], ["pt", "pt"],
  ["es", "es"], ["es-419", "es"], ["es-MX", "es"], ["es-AR", "es"], ["es-ES", "es"],
  ["zh-CN", "zh-CN"], ["zh-TW", "zh-TW"], ["zh-HK", "zh-TW"],
  // Google lists both spellings of Hebrew and Filipino: the one asked for is kept.
  ["he", "he"], ["iw", "iw"], ["fil", "fil"],
  // Norwegian: Bokmål is `nb` in the browsers and `no` in Google; Nynorsk readers get Bokmål.
  ["nb", "no"], ["nb-NO", "no"], ["no", "no"], ["nn", "no"], ["nn-NO", "no"],
  ["sr-Latn", "sr"], ["uk", "uk"], ["ru", "ru"], ["ja", "ja"], ["ko", "ko"],
  ["de-AT", "de"], ["fr-CA", "fr"], ["hi", "hi"], ["hi-IN", "hi"], ["sv-SE", "sv"],
  ["id", "id"], ["id-ID", "id"], ["vi", "vi"], ["vi-VN", "vi"], ["hu", "hu"], ["hu-HU", "hu"],
  ["el", "el"], ["el-GR", "el"], ["ar", "ar"], ["ar-EG", "ar"],
  // Central Kurdish in Arabic script; Google's `ku` is Kurmanji in Latin script.
  ["ku-Arab", "ckb"],
  // Nothing matches: the default.
  ["xx", "en"], ["", "en"],
];

const DEEPL_TABLE: [string, string][] = [
  ["en-US", "en-US"], ["en-GB", "en-GB"],
  ["pt-BR", "pt-BR"], ["pt-PT", "pt-PT"],
  ["es", "es"], ["es-419", "es-419"], ["es-MX", "es"],
  ["zh-CN", "zh-Hans"], ["zh-TW", "zh-Hant"], ["zh-HK", "zh-Hant"],
  ["nb", "nb"], ["nb-NO", "nb"], ["nn", "nb"], ["nn-NO", "nb"],
  ["ar", "ar"], ["vi", "vi"], ["id", "id"], ["hu", "hu"], ["el", "el"], ["ja", "ja"], ["uk", "uk"],
];

describe("findUserLanguage", () => {
  it.each(GOOGLE_TABLE)("Google: UI %j → %j", (uiLanguage, expected) => {
    expect(findUserLanguage(uiLanguage, googleLanguages.targetLanguages, "en")?.code).toBe(expected);
  });

  it.each(DEEPL_TABLE)("DeepL: UI %j → %j", (uiLanguage, expected) => {
    expect(findUserLanguage(uiLanguage, deeplLanguages.targetLanguages, "en-US")?.code).toBe(expected);
  });

  it("falls back to the first language listed, then to null", () => {
    const list = [{ code: "de", name: "German" }, { code: "fr", name: "French" }];
    expect(findUserLanguage("ja", list, "en")?.code).toBe("de");
    expect(findUserLanguage("ja", [], "en")).toBeNull();
  });
});

describe("findClosestLanguage", () => {
  it("keeps the very code asked for when the list has it", () => {
    const list = [{ code: "he", name: "" }, { code: "iw", name: "" }];
    expect(findClosestLanguage("iw", list)?.code).toBe("iw");
    expect(findClosestLanguage("he", list)?.code).toBe("he");
  });

  it("finds the same language in another spelling", () => {
    expect(findClosestLanguage("iw", [{ code: "he", name: "" }])?.code).toBe("he");
    expect(findClosestLanguage("zh-CN", deeplLanguages.targetLanguages)?.code).toBe("zh-Hans");
    expect(findClosestLanguage("zh-Hant", googleLanguages.targetLanguages)?.code).toBe("zh-TW");
  });

  it("prefers the bare language, then the viewer's own regional variant", () => {
    expect(findClosestLanguage("en-US", googleLanguages.targetLanguages)?.code).toBe("en");
    expect(findClosestLanguage("en", deeplLanguages.targetLanguages, "en-US")?.code).toBe("en-US");
    expect(findClosestLanguage("pt", deeplLanguages.targetLanguages, "pt-PT")?.code).toBe("pt-PT");
  });

  it("returns null for a language the list does not offer", () => {
    expect(findClosestLanguage("hi", deeplLanguages.targetLanguages)).toBeNull();
  });
});

describe("isSameLanguage", () => {
  it.each([
    ["nb-NO", "no", true], ["nn", "nb", true], ["pt-BR", "pt-PT", true], ["zh-CN", "zh-Hans", true],
    ["en", "de", false], ["ku-Arab", "ku", false],
  ])("%j and %j → %j", (code, other, expected) => {
    expect(isSameLanguage(code, other)).toBe(expected);
  });
});

describe("matchSelectedLanguages", () => {
  it("Google → DeepL: carries the languages over silently when only the spelling changes", () => {
    const match = matchSelectedLanguages({ sourceLanguageCode: "en", targetLanguageCode: "zh-CN" }, deeplLanguages, "en-US", "en");
    expect(match).toEqual({ sourceLanguageCode: "en", targetLanguageCode: "zh-Hans", sourceReset: false, targetReplacement: null });
  });

  it("DeepL → Google: back again", () => {
    const google = { sourceLanguages: googleLanguages.sourceLanguages, targetLanguages: googleLanguages.targetLanguages };
    const match = matchSelectedLanguages({ sourceLanguageCode: "auto", targetLanguageCode: "en-US" }, google, "en-US", "en");
    expect(match).toEqual({ sourceLanguageCode: "auto", targetLanguageCode: "en", sourceReset: false, targetReplacement: null });
    expect(matchSelectedLanguages({ sourceLanguageCode: "nb", targetLanguageCode: "zh-Hant" }, google, "en", "en"))
      .toMatchObject({ sourceLanguageCode: "no", targetLanguageCode: "zh-TW" });
  });

  it("a source language the translator lacks falls back to auto", () => {
    const match = matchSelectedLanguages({ sourceLanguageCode: "fil", targetLanguageCode: "de" }, deeplLanguages, "de-DE", "en");
    expect(match).toEqual({ sourceLanguageCode: "auto", targetLanguageCode: "de", sourceReset: true, targetReplacement: null });
  });

  it("a target language the translator lacks is replaced by the viewer's language, and reported", () => {
    const match = matchSelectedLanguages({ sourceLanguageCode: "auto", targetLanguageCode: "hi" }, deeplLanguages, "ru-RU", "en");
    expect(match.targetLanguageCode).toBe("ru");
    expect(match.targetReplacement?.code).toBe("ru");
    expect(codes(deeplLanguages.targetLanguages)).not.toContain("hi");
  });
});
