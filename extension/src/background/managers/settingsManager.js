export class SettingsManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.initialize();
  }

  static SETTINGS_VERSION = 1;
  static TOOLTIP_THEME_VERSION = 1;

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

  settingsMigrations = {
    // 2: (oldSettings) => {
    //   return {
    //     ...oldSettings,
    //     newFeatureEnabled: true,
    //   };
    // },
  };

  tooltipThemeMigrations = {
    // 2: (oldTheme) => {
    //   return {
    //     ...oldTheme,
    //     newFeatureEnabled: true,
    //   };
    // },
  };

  initialize() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.initializeSettings();
        this.initializeTooltipTheme();

        this.storageManager.set("installedAt", Date.now(), "sync");
        this.storageManager.set("updatedAt", Date.now(), "sync");

        chrome.action.openPopup();
      } else if (details.reason === "update") {
        this.migrateSettings();
        this.migrateTooltipTheme();

        this.storageManager.set("updatedAt", Date.now(), "sync");
      }
    });
  }

  async migrateSettings() {
    let currentVersion = await this.storageManager.get("settingsVersion", "sync") || 0;
    let settings = await this.storageManager.get("settings", "sync");

    if (!currentVersion || !settings) {
      this.initializeSettings();
      return;
    }

    while (currentVersion < SettingsManager.SETTINGS_VERSION) {
      if (this.settingsMigrations[currentVersion + 1]) {
        settings = this.settingsMigrations[currentVersion + 1](settings);
        currentVersion++;
      } else {
        break;
      }
    }

    this.storageManager.set("settings", settings, "sync");
    this.storageManager.set("settingsVersion", SettingsManager.SETTINGS_VERSION, "sync");
  }

  async migrateTooltipTheme() {
    let currentVersion = await this.storageManager.get("tooltipThemeVersion", "sync") || 0;
    let tooltipTheme = await this.storageManager.get("tooltipTheme", "sync");

    if (!currentVersion || !tooltipTheme) {
      this.initializeTooltipTheme();
      return;
    }

    while (currentVersion < SettingsManager.TOOLTIP_THEME_VERSION) {
      if (this.tooltipThemeMigrations[currentVersion + 1]) {
        tooltipTheme = this.tooltipThemeMigrations[currentVersion + 1](tooltipTheme);
        currentVersion++;
      } else {
        break;
      }
    }

    this.storageManager.set("tooltipTheme", tooltipTheme, "sync");
    this.storageManager.set("tooltipThemeVersion", SettingsManager.TOOLTIP_THEME_VERSION, "sync");
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
    const initialSettings = await this.getInitialSettings();
    this.storageManager.set("settings", initialSettings, "sync");

    this.storageManager.set("settingsVersion", SettingsManager.SETTINGS_VERSION, "sync");
  }

  async initializeTooltipTheme() {
    this.storageManager.set("tooltipTheme", this.initialTooltipTheme, "sync");

    this.storageManager.set("tooltipThemeVersion", SettingsManager.TOOLTIP_THEME_VERSION, "sync");
  }
}
