import { AvailableLanguages, Language } from "../../model/types/schema.ts";

/**
 * Codes that name the same language in the spellings the translators use:
 * Google's legacy `iw` / `jw`, Bing's `fil`, and the regional Chinese codes
 * that stand for a script (`zh-CN` is simplified, `zh-TW` traditional).
 */
const CANONICAL_CODES: Record<string, string> = {
  "iw": "he",
  "jw": "jv",
  "fil": "tl",
  "zh-cn": "zh-hans",
  "zh-sg": "zh-hans",
  "zh-tw": "zh-hant",
  "zh-hk": "zh-hant",
  "zh-mo": "zh-hant",
};

const canonical = (code: string) => {
  const lowerCased = code.toLowerCase();
  return CANONICAL_CODES[lowerCased] ?? lowerCased;
};

const primaryLanguage = (code: string) => canonical(code).split("-")[0];

/**
 * The language in `languages` that best stands for `code`, or null when the
 * translator does not offer that language at all.
 *
 * Translators spell the same language differently — Google has `en` and
 * `zh-CN`, DeepL `en-US`, `en-GB` and `zh-Hans` — and an exact comparison
 * threw the viewer's choice away on every switch between them. In order of
 * preference: the same code, the same script (`zh-CN` → `zh-Hans`), the bare
 * language (`en-US` → `en`), the viewer's own regional variant, and finally
 * any variant of the language.
 */
export const findClosestLanguage = (
  code: string,
  languages: Language[],
  uiLanguage: string = "",
): Language | null => {
  const wanted = canonical(code);

  const exact = languages.find((language) => canonical(language.code) === wanted);
  if (exact) return exact;

  const variants = languages.filter((language) => primaryLanguage(language.code) === primaryLanguage(code));
  if (!variants.length) return null;

  return variants.find((language) => canonical(language.code) === primaryLanguage(code))
    ?? variants.find((language) => canonical(language.code) === canonical(uiLanguage))
    ?? variants[0];
};

/** Whether two codes name the same language, whatever the region or spelling. */
export const isSameLanguage = (code: string, otherCode: string) =>
  primaryLanguage(code) === primaryLanguage(otherCode);

export interface SelectedLanguagesMatch {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  /** The source language is not offered at all, so it fell back to "auto". */
  sourceReset: boolean;
  /** The language that had to replace the target one, when it is a different language. */
  targetReplacement: Language | null;
}

/**
 * The selected languages as a translator with these lists spells them — the
 * one rule for every change of translator (switching, falling back, resetting),
 * so none of them keeps a code the new translator does not list.
 *
 * A target language the translator does not offer is replaced by the viewer's
 * own language, then `defaultTargetCode`, then the first one listed.
 */
export const matchSelectedLanguages = (
  selected: { sourceLanguageCode: string; targetLanguageCode: string },
  availableLanguages: AvailableLanguages,
  uiLanguage: string,
  defaultTargetCode: string,
): SelectedLanguagesMatch => {
  const { sourceLanguageCode, targetLanguageCode } = selected;

  const sourceMatch = sourceLanguageCode === "auto"
    ? null
    : findClosestLanguage(sourceLanguageCode, availableLanguages.sourceLanguages, uiLanguage);
  const sourceReset = sourceLanguageCode !== "auto" && !sourceMatch;

  const targets = availableLanguages.targetLanguages;
  const targetMatch = findClosestLanguage(targetLanguageCode, targets, uiLanguage);
  const newTarget = targetMatch
    ?? findClosestLanguage(uiLanguage, targets, uiLanguage)
    ?? findClosestLanguage(defaultTargetCode, targets, uiLanguage)
    ?? targets[0];

  return {
    sourceLanguageCode: sourceMatch?.code ?? "auto",
    targetLanguageCode: newTarget?.code ?? targetLanguageCode,
    sourceReset,
    targetReplacement: !targetMatch && newTarget && !isSameLanguage(newTarget.code, targetLanguageCode)
      ? newTarget
      : null,
  };
};
