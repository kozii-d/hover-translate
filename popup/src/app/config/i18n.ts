import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const languageDetector = new LanguageDetector();

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
    debug: true,
    // defaultNS: "messages",
    ns: ["messages", "modals", "settings", "customization", "dictionary"],
    backend: {
      loadPath: chrome.runtime.getURL("/_locales/{{lng}}/{{ns}}.json"),
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


export default i18n;