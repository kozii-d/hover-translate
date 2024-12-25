export class SettingsManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.initialize();
  }

  initialSettings = {
    sourceLanguageCode: "auto",
    targetLanguageCode: "en",
    autoPause: true,
  };

  initialTooltipTheme = {
    useYouTubeSettings: true,
    fontFamily: "auto",
    fontColor: "auto",
    fontSize: "auto",
    backgroundColor: "auto",
    backgroundOpacity: "auto",
    characterEdgeStyle: "auto",
    fontOpacity: "auto",
  };

  initialize() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.initializeSettings();
      } else if (details.reason === "update") {
        this.storageManager.set("updatedAt", Date.now(), "sync");
      }
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
      const targetLanguageCode = availableTargetLanguages.includes(userLanguage)
        ? userLanguage : this.initialSettings.targetLanguageCode;

      return {
        ...this.initialSettings,
        targetLanguageCode,
      };
    } catch (error) {
      console.error("Failed to fetch languages from server:", error);
      return this.initialSettings;
    }
  }

  fetchToApi = async (path, options, attempt = 1) => {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY = 1000;

    const config = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    };

    try {
      const response = await fetch(`${__API_URL__}${path}`, config);

      if (!response.ok) {
        if (attempt < MAX_ATTEMPTS && response.status >= 500) {
          console.warn(
            `Attempt ${attempt} failed. Retrying in ${RETRY_DELAY}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return this.fetchToApi(path, options, attempt + 1);
        }

        throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(
          `Attempt ${attempt} failed with error: ${error.message}. Retrying in ${RETRY_DELAY}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return this.fetchToApi(path, options, attempt + 1);
      }

      throw new Error(`Fetch failed after ${MAX_ATTEMPTS} attempts: ${error.message}`);
    }
  };

  async initializeSettings() {
    this.storageManager.set("installedAt", Date.now(), "sync");
    this.storageManager.set("updatedAt", Date.now(), "sync");
    const initialSettings = await this.getInitialSettings();
    this.storageManager.set("settings", initialSettings, "sync");
    this.storageManager.set("tooltipTheme", this.initialTooltipTheme, "sync");
  }
}
