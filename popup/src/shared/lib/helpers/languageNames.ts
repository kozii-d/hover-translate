import { canonicalLanguageCode } from "@extension/common/translators/findClosestLanguage.ts";

/**
 * Google's `zh-CN` and `zh-TW` stand for the two scripts, but `Intl` reads
 * them as regions ("Chinese (China)"). Only the name changes, never the code.
 */
const NAMED_AS: Record<string, string> = {
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
};

/**
 * Codes a translator uses for another language than Google does, as Google's
 * code, or `null` for one Google has no name for. Bing's `ku` is Central
 * Kurdish (Google's `ckb`) and its `kmr` Northern Kurdish (Google's `ku`);
 * DeepL's source `pt` is any Portuguese, while Google's `pt` is Brazilian.
 */
const GOOGLE_CODES: Record<string, Record<string, string | null>> = {
  bing: { ku: "ckb", kmr: "ku" },
  deepl: { pt: null },
};

const toTag = (code: string) => code.replace(/_/g, "-");

/**
 * Names languages in `displayLanguage` (a locale directory such as `pt_BR`
 * or a translator's code), capitalised as a menu item: `code → name`, or
 * `undefined` for a code neither source knows.
 *
 * `googleNames` (the `languages` namespace, Google Translate's own names in
 * that language) come first: Chrome's `Intl` does not know about a quarter of
 * Google's languages. They are matched in any translator's spelling (`zh-Hans`,
 * `iw`, `nb`) and through `GOOGLE_CODES` for the translator the code is
 * `translator`'s; `Intl` names the rest.
 *
 * One call per list: building `Intl.DisplayNames` is expensive and the
 * translators offer close to two hundred languages each.
 */
export const languageNamesIn = (displayLanguage: string, googleNames: Record<string, string> = {}) => {
  const locale = toTag(displayLanguage);
  const displayNames = new Intl.DisplayNames(locale, { type: "language", languageDisplay: "standard", fallback: "none" });
  const googleNamesByCode = new Map(Object.entries(googleNames)
    .map(([code, name]) => [canonicalLanguageCode(code), name]));

  const intlName = (tag: string) => {
    try {
      return displayNames.of(NAMED_AS[tag] ?? tag);
    } catch {
      // Bing's and DeepL's codes come from the network: one `Intl` cannot read is not an error.
      return undefined;
    }
  };

  // No translator for the popup's own languages (the menu of popup languages).
  return (code: string, translator = ""): string | undefined => {
    const tag = toTag(code);
    const googleCode = GOOGLE_CODES[translator]?.[tag];
    const googleName = googleCode === null ? undefined : googleNamesByCode.get(canonicalLanguageCode(googleCode ?? tag));
    const name = googleName || intlName(tag);
    return name && name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  };
};
