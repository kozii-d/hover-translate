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

languageDetector.addDetector({
  name: "detectUILanguage",
  lookup() {
    const lang = chrome.i18n.getUILanguage() || navigator.language || "en";
    return lang.includes("-") ? lang.split("-")[0] : lang;
  },
});

i18n
  .use(Backend)
  .use(LanguageDetector)
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
      lookupLocalStorage: "hoverTranslatePopupLanguage",
      order: ["localStorage", "detectUILanguage"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

i18n.on("languageChanged", (lang) => {
  const dayjsLang = lang.toLowerCase().replace("_", "-");
  dayjs.locale(dayjsLang);
});

export default i18n;