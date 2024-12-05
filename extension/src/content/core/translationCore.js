import { TRANSLATION_URL } from "../utils/constants.js";
import QuickLRU from "quick-lru";

export class TranslationCore {
  constructor(state) {
    this.state = state;
    this.translationCache = new QuickLRU({ maxSize: 3000 });
  }

  async loadTranslationCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get("translationCache", (result) => {
        if (result.translationCache) {
          const entries = result.translationCache.entries || [];
          entries.forEach(([key, value]) => {
            this.translationCache.set(key, value);
          });
        }
        this.state.cacheLoaded = true;
        resolve();
      });
    });
  }

  saveTranslationCache() {
    // Convert the Map to an array of entries before saving
    const entries = Array.from(this.translationCache.entries());
    chrome.storage.local.set({ translationCache: { entries } });
  }

  async translateText(text, signal) {
    const normalizedText = text.trim().toLowerCase();
    const cacheKey = `${normalizedText}_${this.state.settings.sourceLanguageCode}_${this.state.settings.targetLanguageCode}`;

    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey);
    }

    try {
      const response = await fetch(TRANSLATION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          sourceLocale: this.state.settings.sourceLanguageCode,
          targetLocale: this.state.settings.targetLanguageCode,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { text: translatedText } = await response.json();

      this.translationCache.set(cacheKey, translatedText);
      this.saveTranslationCache();

      return translatedText;
    } catch (e) {
      if (e?.name === "AbortError") {
        // eslint-disable-next-line no-console
        console.log("Fetch aborted");
      } else {
        console.error(`Translation error: ${e}`);
      }
      return "";
    } finally {
      this.state.currentAbortController = null;
    }
  }
}