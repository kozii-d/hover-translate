import QuickLRU from "quick-lru";

export class TranslationCore {
  constructor(state, tokenManager, storageManager) {
    this.state = state;
    this.translationCache = new QuickLRU({ maxSize: 3000 });
    this.tokenManager = tokenManager;
    this.storageManager = storageManager;
    this.currentTranslationData = null;

    this.loadTranslationCache();
  }

  async loadTranslationCache() {
    return this.storageManager.get("translationCache", "local").then((translationCache) => {
      (translationCache || []).forEach(({ key, value }) => {
        this.translationCache.set(key, value);
      });
      this.state.cacheLoaded = true;
    });
  }

  saveTranslationCache() {
    const newCacheArray = Array.from(this.translationCache.entries(), ([key, value]) => ({ key, value }));
    this.storageManager.set("translationCache", newCacheArray, "local");
  }

  async translateText(text, signal) {
    const normalizedText = text.trim().toLowerCase();

    if (!normalizedText) {
      return "";
    }

    const cacheKey = `${normalizedText}_${this.state.settings.sourceLanguageCode}_${this.state.settings.targetLanguageCode}`;

    if (this.translationCache.has(cacheKey)) {
      const cachedData = this.translationCache.get(cacheKey);
      this.currentTranslationData = cachedData;
      return cachedData;
    }

    const queryParams = new URLSearchParams({
      input: text,
      sourceLanguageCode: this.state.settings.sourceLanguageCode,
      targetLanguageCode: this.state.settings.targetLanguageCode,
    }).toString();

    try {
      const translatedData = await this.fetchToApi(`/translation/translate?${queryParams}`, {
        method: "GET",
        signal,
      });

      this.currentTranslationData = {
        sourceLanguageCode: translatedData.detectedLanguageCode,
        targetLanguageCode: this.state.settings.targetLanguageCode,
        translatedText: translatedData.translatedText,
        originalText: text,
      };

      this.translationCache.set(cacheKey, this.currentTranslationData);
      this.saveTranslationCache();

      return translatedData;
    } catch (error) {
      if (error?.name === "AbortError") {
        // eslint-disable-next-line no-console
        console.log("Fetch aborted");
      } else {
        throw error;
      }
      return "";
    } finally {
      this.state.currentAbortController = null;
    }
  }

  fetchToApi = async (path, options, attempt = 1) => {
    const MAX_ATTEMPTS = 3;
    const idTokenData = await this.tokenManager.getIdTokenFromStorage();

    const config = {
      ...options,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (!idTokenData || !idTokenData?.idToken || !idTokenData?.idTokenPayload) {
      this.tokenManager.sendMessage("openPopup");
      return;
    }
    if (!this.tokenManager.checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
      config.headers.Authorization = `Bearer ${idTokenData.idToken}`;
    } else {
      if (attempt > MAX_ATTEMPTS) {
        throw new Error("Exceeded maximum attempts to restore the ID token.");
      }
      await this.tokenManager.sendMessage("restoreIdToken");
      return this.fetchToApi(path, options, attempt + 1);
    }

    const response = await fetch(`${__API_URL__}${path}`, config);

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };
}