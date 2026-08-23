import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

import "dayjs/locale/en";

// European
import "dayjs/locale/cs";
import "dayjs/locale/de";
import "dayjs/locale/es";
import "dayjs/locale/fi";
import "dayjs/locale/fr";
import "dayjs/locale/it";
import "dayjs/locale/pl";
import "dayjs/locale/pt";
import "dayjs/locale/pt-br";
import "dayjs/locale/sv";
import "dayjs/locale/tr";

// Cyrillic
import "dayjs/locale/ru";
import "dayjs/locale/uk";

// Asian
import "dayjs/locale/hi";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";

import dayjs from "dayjs";

const languageDetector = new LanguageDetector();
const baseUrl = chrome.runtime.getURL("/");

const supportedLanguages = [
  "en",

  // European
  "cs",
  "de",
  "es",
  "fi",
  "fr",
  "it",
  "pl",
  "pt_BR",
  "pt_PT",
  "sv",
  "tr",

  // Cyrillic
  "ru",
  "uk",

  // Asian
  "hi",
  "ja",
  "ko",
  "zh_CN",
  "zh_TW",
];

/**
 * Browser language tags that must not simply lose their region.
 *
 * The locale directories are named the way the Chrome i18n API names them
 * (`pt_BR`, `zh_CN`) and there is no region-less `pt` or `zh` among them, so
 * stripping the region — which is the right thing for `de-DE` or `en-US` —
 * left every Portuguese and Chinese viewer on the English fallback even though
 * their translations ship with the extension.
 *
 * Region-less `pt` and `zh` follow CLDR, where they stand for Brazilian
 * Portuguese and Simplified Chinese respectively.
 */
const UI_LANGUAGE_OVERRIDES: Record<string, string> = {
  "pt": "pt_BR",
  "pt-br": "pt_BR",
  "pt-pt": "pt_PT",
  "zh": "zh_CN",
  "zh-cn": "zh_CN",
  "zh-sg": "zh_CN",
  "zh-hans": "zh_CN",
  "zh-tw": "zh_TW",
  "zh-hk": "zh_TW",
  "zh-mo": "zh_TW",
  "zh-hant": "zh_TW",
};

const normalizeLanguageTag = (lang: string) => lang.toLowerCase().replace(/_/g, "-");

/**
 * The locale directory to use for a browser language tag, or "en" when nothing
 * matches.
 *
 * Subtags are dropped from the right, so `zh-Hant-HK` is tried as `zh-hant-hk`,
 * then `zh-hant`, then `zh` — which is what `getUILanguage()` can actually
 * return once script subtags are involved.
 */
const resolveUILanguage = (lang: string): string => {
  const subtags = normalizeLanguageTag(lang).split("-");

  for (let length = subtags.length; length > 0; length--) {
    const code = subtags.slice(0, length).join("-");

    const override = UI_LANGUAGE_OVERRIDES[code];
    if (override) return override;

    const supported = supportedLanguages.find((supportedLang) => normalizeLanguageTag(supportedLang) === code);
    if (supported) return supported;
  }

  return "en";
};

const detectUILanguage = () => resolveUILanguage(chrome.i18n.getUILanguage() || navigator.language || "en");

languageDetector.addDetector({
  name: "detectUILanguage",
  lookup: detectUILanguage,
});

const LANGUAGE_STORAGE_KEY = "hoverTranslatePopupLanguage";
const LANGUAGE_RESET_KEY = "hoverTranslatePopupLanguageReset";

/**
 * Drops the "en" that older builds pinned on everybody, once.
 *
 * Detection never ran in those builds (the detector was registered on an
 * instance i18next never used), so every viewer resolved to the `en` fallback —
 * and `caches: ["localStorage"]` then wrote that `en` back as if it were their
 * choice. Since `localStorage` comes first in the detection order, that stale
 * entry would keep overriding the now-working detector forever.
 *
 * A stored value is only cleared when it is exactly `en` *and* detection would
 * pick something else, so a deliberate choice of any other language is left
 * alone, and viewers whose browser is English see no change either way. The two
 * cases that remain indistinguishable — pinned by the bug versus deliberately
 * set to English on a non-English browser — are resolved in favour of the
 * former, which the bug made overwhelmingly more common. The marker makes sure
 * this happens only once, so a viewer who does want English keeps it.
 */
const clearLanguagePinnedByDetectionBug = () => {
  try {
    if (localStorage.getItem(LANGUAGE_RESET_KEY)) return;

    if (localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" && detectUILanguage() !== "en") {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    }

    localStorage.setItem(LANGUAGE_RESET_KEY, "done");
  } catch (error) {
    // Nothing here is worth a blank popup: without storage the detector simply
    // runs on every open, which is the behaviour we want anyway.
    console.warn("Could not reset the stored popup language", error);
  }
};

clearLanguagePinnedByDetectionBug();

i18n
  .use(Backend)
  // The instance, not the class: i18next instantiates a class module itself, and
  // that fresh instance knows nothing about `detectUILanguage` — which is why no
  // language was ever detected and every viewer started out in English.
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: false,
    ns: ["messages", "modals", "settings", "customize", "dictionary", "about", "common"],
    backend: {
      loadPath: `${baseUrl}_locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      order: ["localStorage", "detectUILanguage"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

/**
 * dayjs does not name its locales the way the locale directories do, and it
 * ships European Portuguese as plain `pt`: the old `pt_PT` -> `pt-pt` guess
 * matched nothing, so dates silently stayed in the previous locale.
 */
const DAYJS_LOCALES: Record<string, string> = {
  "pt_BR": "pt-br",
  "pt_PT": "pt",
  "zh_CN": "zh-cn",
  "zh_TW": "zh-tw",
};

i18n.on("languageChanged", (lang) => {
  dayjs.locale(DAYJS_LOCALES[lang] ?? lang.toLowerCase());
});

export default i18n;