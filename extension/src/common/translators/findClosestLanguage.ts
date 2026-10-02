import { AvailableLanguages, Language } from "../types/languages.ts";

/**
 * Codes that name the same language in the spellings the translators use:
 * Google's legacy `iw` / `jw`, Bing's `fil`, Norwegian Bokmål (`nb` in the
 * browsers, DeepL and Bing, `no` in Google) and Nynorsk (`nn`, the other
 * written Norwegian, which no translator offers and whose readers read Bokmål
 * freely), Central Kurdish in Arabic script
 * (`ku-Arab` in the browsers, `ckb` in Google — Google's `ku` is Kurmanji in
 * Latin script), Dari (`prs` in Bing, `fa-AF` in Google), and the regional
 * Chinese codes that stand for a script (`zh-CN` is simplified, `zh-TW`
 * traditional).
 */
const CANONICAL_CODES: Record<string, string> = {
  "iw": "he",
  "jw": "jv",
  "fil": "tl",
  "nb": "no",
  "nn": "no",
  "ku-arab": "ckb",
  "prs": "fa-af",
  "zh-cn": "zh-hans",
  "zh-sg": "zh-hans",
  "zh-tw": "zh-hant",
  "zh-hk": "zh-hant",
  "zh-mo": "zh-hant",
};

/** One spelling for the codes above, in lower case: `zh-CN` and `zh-Hans` are both `zh-hans`. */
export const canonicalLanguageCode = (code: string) => {
  const lowerCased = code.toLowerCase();
  return CANONICAL_CODES[lowerCased] ?? lowerCased;
};

/**
 * A bare code that stands for one of the scripts its language is listed in:
 * Google's `zh` was "Chinese (Simplified)" next to `zh-TW`, so a viewer who
 * picked it chose that script, whatever their own Chinese.
 */
const BARE_CODES: Record<string, string> = {
  "zh": "zh-hans",
};

// Canonical again for a regional code whose language has two spellings (`nb-NO`).
const primaryLanguage = (code: string) => canonicalLanguageCode(canonicalLanguageCode(code).split("-")[0]);

/**
 * The language in `languages` that best stands for `code`, or null when the
 * translator does not offer that language at all.
 *
 * Translators spell the same language differently — Google has `en` and
 * `zh-CN`, DeepL `en-US`, `en-GB` and `zh-Hans` — and an exact comparison
 * threw the viewer's choice away on every switch between them. In order of
 * preference: the very same code (a list may spell a language two ways, and
 * the one asked for is kept), the same language in another spelling or the
 * same script (`iw` → `he`, `zh-CN` → `zh-Hans`), the bare language
 * (`en-US` → `en`, `zh` → `zh-CN`), the viewer's own regional variant, and
 * finally any variant of the language.
 */
export const findClosestLanguage = (
  code: string,
  languages: Language[],
  uiLanguage: string = "",
): Language | null => {
  const same = languages.find((language) => language.code === code);
  if (same) return same;

  const wanted = canonicalLanguageCode(code);

  const exact = languages.find((language) => canonicalLanguageCode(language.code) === wanted);
  if (exact) return exact;

  const variants = languages.filter((language) => primaryLanguage(language.code) === primaryLanguage(code));
  if (!variants.length) return null;

  const bare = BARE_CODES[wanted] ?? primaryLanguage(code);
  return variants.find((language) => canonicalLanguageCode(language.code) === bare)
    ?? variants.find((language) => canonicalLanguageCode(language.code) === canonicalLanguageCode(uiLanguage))
    ?? variants[0];
};

/**
 * The viewer's own language as `languages` spells it (`pt-BR` → `pt`), else
 * `defaultCode`, else the first one listed — the one rule for picking a target
 * language for the viewer: on install, on "reset to defaults", and when a
 * change of translator loses the selected one.
 */
export const findUserLanguage = (
  uiLanguage: string,
  languages: Language[],
  defaultCode: string,
): Language | null =>
  findClosestLanguage(uiLanguage, languages, uiLanguage)
    ?? findClosestLanguage(defaultCode, languages, uiLanguage)
    ?? languages[0]
    ?? null;

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
  const newTarget = targetMatch ?? findUserLanguage(uiLanguage, targets, defaultTargetCode);

  return {
    sourceLanguageCode: sourceMatch?.code ?? "auto",
    targetLanguageCode: newTarget?.code ?? targetLanguageCode,
    sourceReset,
    targetReplacement: !targetMatch && newTarget && !isSameLanguage(newTarget.code, targetLanguageCode)
      ? newTarget
      : null,
  };
};
