export class LanguageManager {
  constructor(tokenManager) {
    this.tokenManager = tokenManager;
    this.initialize();
  }

  initialize() {
    // Event listener for when the extension is installed or updated
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeLanguages();
    });
  }

  getUserLanguage() {
    return chrome.i18n.getUILanguage();
  }

  async getInitialSettings() {
    try {
      // Get available languages
      const data = await this.fetchToApi("/translation/languages");

      if (!data || !Array.isArray(data.targetLanguages)) {
        throw new Error("Invalid data from server");
      }

      const userLanguage = this.getUserLanguage();

      const availableTargetLanguages = data.targetLanguages.map((lang) => lang.code);
      const targetLanguageCode = availableTargetLanguages.includes(userLanguage) ? userLanguage : "en-US";

      return {
        sourceLanguageCode: "auto",
        targetLanguageCode,
        autoPause: true,
      };
    } catch (error) {
      console.error("Failed to fetch languages from server:", error);
      return {
        sourceLanguageCode: "auto",
        targetLanguageCode: "en-US",
        autoPause: true,
      };
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

    if (idTokenData && idTokenData.idToken && !this.tokenManager.checkIsTokenExpired(idTokenData.idTokenPayload.exp)) {
      config.headers.Authorization = `Bearer ${idTokenData.idToken}`;
    } else {
      if (attempt > MAX_ATTEMPTS) {
        throw new Error("Exceeded maximum attempts to restore the ID token.");
      }
      await this.tokenManager.restoreToken();
      return this.fetchToApi(path, options, attempt + 1);
    }

    const response = await fetch(`${__API_URL__}${path}`, config);
    return response.json();
  };

  async initializeLanguages() {
    chrome.storage.sync.get(["settings"], async (result) => {
      if (!result.settings) {
        const initialSettings = await this.getInitialSettings();
        chrome.storage.sync.set({ settings: initialSettings });
      }
    });
  }
}
