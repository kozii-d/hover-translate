import QuickLRU from "quick-lru";
import { state } from "../state/stateManager.ts";
import { StorageService } from "../../common/services/storageService.ts";
import { TokenService } from "../services/tokenService.ts";
import { TranslationCacheData } from "../../common/types/translations.ts";
import { ApiService } from "../../common/services/apiService.ts";

type TranslationCache = QuickLRU<string, TranslationCacheData>;

type TranslationCacheFromStorage = { key: string; value: TranslationCacheData }[];

interface TranslateApiResponse {
  detectedLanguageCode: string;
  translatedText: string;
}

export class TranslationCore {
  private translationCache: TranslationCache;
  public currentTranslationData: TranslationCacheData | null;

  constructor(
    private readonly tokenService: TokenService = new TokenService(),
    private readonly storageService: StorageService = new StorageService(),
    private readonly api: ApiService = new ApiService(),
  ) {
    this.translationCache = new QuickLRU<string, TranslationCacheData>({ maxSize: 3000 });
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
    const normalizedText = text.trim().toLowerCase();

    if (!normalizedText) {
      return null;
    }

    const cacheKey = `${normalizedText}_${state.settings.sourceLanguageCode}_${state.settings.targetLanguageCode}`;

    if (this.translationCache.has(cacheKey)) {
      const cachedData = this.translationCache.get(cacheKey);
      if (!cachedData) {
        return null;
      }
      this.currentTranslationData = cachedData;
      return cachedData;
    }

    const queryParams = new URLSearchParams({
      input: text,
      sourceLanguageCode: state.settings.sourceLanguageCode,
      targetLanguageCode: state.settings.targetLanguageCode,
    }).toString();

    try {
      const translatedData = await this.fetchWithAuth<TranslateApiResponse>(
        `/translation/translate?${queryParams}`,
        { signal }
      );

      if (!translatedData) {
        return null;
      }


      const result: TranslationCacheData = {
        sourceLanguageCode: translatedData.detectedLanguageCode,
        targetLanguageCode: state.settings.targetLanguageCode,
        translatedText: translatedData.translatedText,
        originalText: text,
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

  private fetchWithAuth = async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    const idToken = await this.tokenService.getIdTokenFromStorage();

    if (!idToken) return null;

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    };

    return this.api.fetchData(path, {
      ...options,
      headers,
    });
  };
}