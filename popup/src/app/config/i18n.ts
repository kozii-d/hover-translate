import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

import "dayjs/locale/en";
import "dayjs/locale/uk";
import "dayjs/locale/ru";
import "dayjs/locale/es";
import "dayjs/locale/fr";
import "dayjs/locale/de";
import "dayjs/locale/pl";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/hi";
import "dayjs/locale/pt";
import "dayjs/locale/pt-br";

import dayjs from "dayjs";

const languageDetector = new LanguageDetector();
const baseUrl = chrome.runtime.getURL("/");

const supportedLanguages = ["en", "de", "es", "fr", "hi", "ja", "ko", "pl", "pt_BR", "pt_PT", "ru", "uk"];

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
    ns: ["messages", "modals", "settings", "customize", "dictionary", "common"],
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