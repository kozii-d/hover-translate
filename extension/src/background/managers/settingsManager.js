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
    // Event listener for when the extension is installed or updated
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeSettings();
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
    this.storageManager.get("settings", "sync").then(async (settings) => {
      if (!settings) {
        const initialSettings = await this.getInitialSettings();
        this.storageManager.set("settings", initialSettings, "sync");
      }
    });

    this.storageManager.get("tooltipTheme", "sync").then((tooltipTheme) => {
      if (!tooltipTheme) {
        this.storageManager.set("tooltipTheme", this.initialTooltipTheme, "sync");
      }
    });
  }
}
