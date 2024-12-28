import { SettingsMigrationsService } from "./settingsMigrationsService.ts";
import { TooltipThemeMigrationsService } from "./tooltipThemeMigrationsService.ts";
import { apiService } from "../../common/services/apiService.ts";
import { StorageService } from "../../common/services/storageService.ts";

export interface Settings {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
}

export interface TooltipTheme {
  useYouTubeSettings: boolean;
  fontFamily: string;
  fontColor: string;
  fontSize: string;
  backgroundColor: string;
  backgroundOpacity: string;
  characterEdgeStyle: string;
  fontOpacity: string;
}

export class SettingsService {
  static readonly SETTINGS_VERSION = 1;
  static readonly TOOLTIP_THEME_VERSION = 1;
  
  private readonly defaultSettings: Settings = {
    sourceLanguageCode: "auto",
    targetLanguageCode: "en",
    autoPause: true,
  };

  private readonly defaultTooltipTheme: TooltipTheme = {
    useYouTubeSettings: true,
    fontFamily: "auto",
    fontColor: "auto",
    fontSize: "auto",
    backgroundColor: "auto",
    backgroundOpacity: "auto",
    characterEdgeStyle: "auto",
    fontOpacity: "auto",
  };

  constructor(
    private readonly storageService: StorageService = new StorageService(),
    private readonly settingsMigrationsService: SettingsMigrationsService = new SettingsMigrationsService(),
    private readonly tooltipThemeMigrationsService: TooltipThemeMigrationsService = new TooltipThemeMigrationsService(),
  ) {
    this.setUpChromeEventListeners();
  }
  private setUpChromeEventListeners() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.handleExtensionInstall();
      } else if (details.reason === "update") {
        this.handleExtensionUpdate();
      }
    });
  }
  
  private async handleExtensionInstall() {
    this.initializeDefaultSettings();
    this.initializeDefaultTooltipTheme();

    const currentTime = Date.now();
    this.storageService.set("installedAt", currentTime, "sync");
    this.storageService.set("updatedAt", currentTime, "sync");

    chrome.action.openPopup();
  }
  
  private async handleExtensionUpdate() {
    this.migrateSettings();
    this.migrateTooltipTheme();

    this.storageService.set("updatedAt", Date.now(), "sync");
  }

  private async migrateSettings() {
    const currentVersion = (await this.storageService.get<number>("settingsVersion", "sync")) || 0;
    const currentSettings = await this.storageService.get<Settings>("settings", "sync");

    const migrated = this.settingsMigrationsService.migrate(
      currentSettings, 
      currentVersion, 
      SettingsService.SETTINGS_VERSION
    );
    
    if (!migrated) {
      await this.initializeDefaultSettings();
      return;
    }
    
    this.storageService.set("settings", migrated, "sync");
    this.storageService.set("settingsVersion", SettingsService.SETTINGS_VERSION, "sync");
  }

  private async migrateTooltipTheme() {
    const currentVersion = (await this.storageService.get<number>("tooltipThemeVersion", "sync")) || 0;
    const currentTooltipTheme = await this.storageService.get<TooltipTheme>("tooltipTheme", "sync");
    
    const migrated = this.tooltipThemeMigrationsService.migrate(
      currentTooltipTheme, 
      currentVersion, 
      SettingsService.TOOLTIP_THEME_VERSION
    );
    
    if (!migrated) {
      await this.initializeDefaultTooltipTheme();
      return;
    }
 
    this.storageService.set("tooltipTheme", migrated, "sync");
    this.storageService.set("tooltipThemeVersion", SettingsService.TOOLTIP_THEME_VERSION, "sync");
  }

  private getUserLanguage(): string {
    return chrome.i18n.getUILanguage();
  }

  private async getInitialSettings(): Promise<Settings> {
    try {
      const data = await apiService.fetchData<{ targetLanguages: { code: string }[] }>("/translation/languages1");

      if (!data || !Array.isArray(data.targetLanguages)) {
        throw new Error("Invalid data from server");
      }

      const userLanguage = this.getUserLanguage();
      const availableTargetLanguages = data.targetLanguages.map((lang) => lang.code);

      const targetLanguageCode = availableTargetLanguages.includes(userLanguage)
        ? userLanguage
        : this.defaultSettings.targetLanguageCode;

      return { ...this.defaultSettings, targetLanguageCode };
    } catch (error) {
      console.error("Failed to fetch languages from server:", error);
      return this.defaultSettings;
    }
  }

  private async initializeDefaultSettings() {
    const initialSettings = await this.getInitialSettings();
    this.storageService.set("settings", initialSettings, "sync");
    this.storageService.set("settingsVersion", SettingsService.SETTINGS_VERSION, "sync");
  }

  private async initializeDefaultTooltipTheme() {
    this.storageService.set("tooltipTheme", this.defaultTooltipTheme, "sync");
    this.storageService.set("tooltipThemeVersion", SettingsService.TOOLTIP_THEME_VERSION, "sync");
  }
}