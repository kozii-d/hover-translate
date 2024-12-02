import { TRANSLATION_URL } from "./constants.js";
import { state } from "./variables.js";

import QuickLRU from "quick-lru";

const CACHE_MAX_SIZE = 3000;

export const translationCache = new QuickLRU({ maxSize: CACHE_MAX_SIZE });

export function loadTranslationCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get("translationCache", (result) => {
      if (result.translationCache) {
        const entries = result.translationCache.entries || [];
        entries.forEach(([key, value]) => {
          translationCache.set(key, value);
        });
      }
      state.cacheLoaded = true;
      resolve();
    });
  });
}

export function saveTranslationCache() {
  // Convert the Map to an array of entries before saving
  const entries = Array.from(translationCache.entries());
  chrome.storage.local.set({ translationCache: { entries } });
}

export async function translateText(text, signal) {
  const normalizedText = text.trim().toLowerCase();
  const cacheKey = `${normalizedText}_${state.settings.sourceLanguageCode}_${state.settings.targetLanguageCode}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const response = await fetch(TRANSLATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        sourceLocale: state.settings.sourceLanguageCode,
        targetLocale: state.settings.targetLanguageCode,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { text: translatedText } = await response.json();

    translationCache.set(cacheKey, translatedText);
    saveTranslationCache();

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
    state.currentAbortController = null;
  }
}