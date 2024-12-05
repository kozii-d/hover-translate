class BackgroundManager {
  constructor() {
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
      const response = await fetch(`${__API_URL__}/translation/languages`);
      const data = await response.json();

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

  async initializeLanguages() {
    chrome.storage.sync.get(["settings"], async (result) => {
      if (!result.settings) {
        const initialSettings = await this.getInitialSettings();
        chrome.storage.sync.set({ settings: initialSettings });
      }
    });
  }
}

new BackgroundManager();