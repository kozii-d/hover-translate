import QuickLRU from "quick-lru";

export class TranslationCore {
  constructor(state, tokenManager, storageManager) {
    this.state = state;
    this.translationCache = new QuickLRU({ maxSize: 3000 });
    this.tokenManager = tokenManager;
    this.storageManager = storageManager;

    this.loadTranslationCache();
  }

  async loadTranslationCache() {
    return this.storageManager.get("translationCache", "local").then((translationCache) => {
      const entries = translationCache.entries || [];
      entries.forEach(([key, value]) => {
        this.translationCache.set(key, value);
      });
      this.state.cacheLoaded = true;
    });
  }

  saveTranslationCache() {
    // Convert the Map to an array of entries before saving
    const entries = Array.from(this.translationCache.entries());
    this.storageManager.set("translationCache", { entries }, "local");
  }

  async translateText(text, signal) {
    const normalizedText = text.trim().toLowerCase();
    const cacheKey = `${normalizedText}_${this.state.settings.sourceLanguageCode}_${this.state.settings.targetLanguageCode}`;

    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey);
    }

    const queryParams = new URLSearchParams({
      input: text,
      sourceLocale: this.state.settings.sourceLanguageCode,
      targetLocale: this.state.settings.targetLanguageCode,
    }).toString();

    try {
      const { translatedText } = await this.fetchToApi(`/translation/translate?${queryParams}`, {
        method: "GET",
        signal,
      });

      this.translationCache.set(cacheKey, translatedText);
      this.saveTranslationCache();

      return translatedText;
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
    return response.json();
  };
}