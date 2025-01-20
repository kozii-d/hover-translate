import QuickLRU from "quick-lru";
import { state } from "../state/stateManager.ts";
import { StorageService } from "../../common/services/storageService.ts";
import { TranslationCacheData } from "../../common/types/translations.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";

type TranslationCache = QuickLRU<string, TranslationCacheData>;

type TranslationCacheFromStorage = { key: string; value: TranslationCacheData }[];

export class TranslationCore {
  private translationCache: TranslationCache;
  public currentTranslationData: TranslationCacheData | null;

  constructor(
    private readonly translator: BaseTranslator,
    private readonly storageService: StorageService = new StorageService(),
  ) {
    this.translationCache = new QuickLRU<string, TranslationCacheData>({ maxSize: 5000 });
    this.currentTranslationData = null;

    this.loadTranslationCache();
  }

  async loadTranslationCache() {
    return this.storageService.get<TranslationCacheFromStorage>("translationCache", "local").then((translationCache) => {
      (translationCache || []).forEach(({ key, value }) => {
        this.translationCache.set(key, value);
      });
      state.cacheLoaded = true;
    });
  }

  saveTranslationCache() {
    const newCacheArray = Array.from(this.translationCache.entries(), ([key, value]) => ({ key, value }));
    this.storageService.set<TranslationCacheFromStorage>("translationCache", newCacheArray, "local");
  }

  async translateText(text: string, signal?: AbortSignal): Promise<TranslationCacheData | null> {
    const normalizedText = text.trim();

    if (!normalizedText) {
      return null;
    }

    // todo: add a translator name to the cache key
    const cacheKey = `${normalizedText}_${state.settings.sourceLanguageCode}_${state.settings.targetLanguageCode}`;

    if (this.translationCache.has(cacheKey)) {
      const cachedData = this.translationCache.get(cacheKey);
      if (!cachedData) {
        return null;
      }
      this.currentTranslationData = cachedData;
      return cachedData;
    }

    try {
      const translatedData = await this.translator.translate(
        normalizedText,
        state.settings.sourceLanguageCode,
        state.settings.targetLanguageCode,
        signal
      );

      if (!translatedData) {
        return null;
      }

      const result: TranslationCacheData = {
        sourceLanguageCode: translatedData.detectedLanguageCode,
        targetLanguageCode: state.settings.targetLanguageCode,
        translatedText: translatedData.translatedText,
        originalText: text,
        dictionary: translatedData.dictionary,
        transliteration: translatedData.transliteration,
        transcription: translatedData.transcription,
        translatorName: this.translator.name,
      };

      this.currentTranslationData = result;
      this.translationCache.set(cacheKey, result);
      this.saveTranslationCache();

      return result;
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        // eslint-disable-next-line no-console
        console.log("Fetch aborted");
        return null;
      } else {
        throw error;
      }
    }
  }
}