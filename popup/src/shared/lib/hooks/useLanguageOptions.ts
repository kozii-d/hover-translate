import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Language } from "@extension/common/types/languages.ts";
import { LanguageOption } from "@/shared/ui/LanguageSelect/LanguageSelect.tsx";
import { languageNamesIn, toTag } from "@/shared/lib/helpers/languageNames.ts";

/**
 * The options of a language field for `translator`'s lists: each language
 * named in the popup's language and sorted by that name.
 */
export const useLanguageOptions = (translator: string) => {
  // `languages`: Google Translate's names of the languages, loaded with the strings.
  const { i18n } = useTranslation("languages");
  const popupLanguage = i18n.language;

  // In English the translators' own names stay: Google's are the ones its site
  // shows, and Bing's and DeepL's are already English.
  const languageNames = useMemo(() => popupLanguage === "en"
    ? undefined
    : languageNamesIn(popupLanguage, i18n.getResourceBundle(popupLanguage, "languages")), [i18n, popupLanguage]);

  /** `translator`: the one whose language this is — a code can mean another language elsewhere. */
  const getLanguageLabel = useCallback((language: Language, translator: string) =>
    languageNames?.(language.code, translator) || language.name || language.code, [languageNames]);

  const toSortedOptions = useCallback((languages: Language[]): LanguageOption[] => {
    const collator = new Intl.Collator(toTag(popupLanguage));
    return languages
      .map((language) => ({
        value: language.code,
        label: getLanguageLabel(language, translator),
        englishName: language.name,
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [getLanguageLabel, popupLanguage, translator]);

  return { getLanguageLabel, toSortedOptions };
};
