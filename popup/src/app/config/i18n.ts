import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

import "dayjs/locale/en";
import "dayjs/locale/uk";
import "dayjs/locale/ru";
import dayjs from "dayjs";

const languageDetector = new LanguageDetector();
const baseUrl = chrome.runtime.getURL("/");

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
    supportedLngs: ["en", "uk", "ru"],
    nonExplicitSupportedLngs: true,
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
  dayjs.locale(lang);
});

export default i18n;