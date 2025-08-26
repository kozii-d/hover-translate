import { SettingsMigrationsService } from "./settingsMigrationsService.ts";
import { TooltipThemeMigrationsService } from "./tooltipThemeMigrationsService.ts";
import { StorageService } from "../../common/services/storageService.ts";
import { defaultSettings, defaultTooltipTheme } from "../../common/consts/defaultValues.ts";
import type { Settings, TooltipTheme } from "../../common/types/settings.ts";
import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";

export class SettingsService {
  static readonly SETTINGS_VERSION = 3;
  static readonly TOOLTIP_THEME_VERSION = 1;

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
    const isAlreadyInstalled = await this.storageService.get("installedAt", "sync");
    if (isAlreadyInstalled) return;

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
      const translator = TranslatorFactory.create(defaultSettings.translator);
      const availableLanguages = await translator.getAvailableLanguages();

      const userLanguage = this.getUserLanguage();
      const availableTargetLanguages = availableLanguages.targetLanguages.map((lang) => lang.code);

      const targetLanguageCode = availableTargetLanguages.includes(userLanguage)
        ? userLanguage
        : defaultSettings.targetLanguageCode;

      return { ...defaultSettings, targetLanguageCode };
    } catch (error) {
      console.error("Failed to fetch languages from server:", error);
      return defaultSettings;
    }
  }

  private async initializeDefaultSettings() {
    const initialSettings = await this.getInitialSettings();
    this.storageService.set("settings", initialSettings, "sync");
    this.storageService.set("settingsVersion", SettingsService.SETTINGS_VERSION, "sync");
  }

  private async initializeDefaultTooltipTheme() {
    this.storageService.set("tooltipTheme", defaultTooltipTheme, "sync");
    this.storageService.set("tooltipThemeVersion", SettingsService.TOOLTIP_THEME_VERSION, "sync");
  }
}