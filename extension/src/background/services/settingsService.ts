import { SettingsMigrationsService } from "./settingsMigrationsService.ts";
import { TooltipThemeMigrationsService } from "./tooltipThemeMigrationsService.ts";
import { StorageService } from "../../common/services/storageService.ts";
import { defaultSettings, defaultTooltipTheme } from "../../common/consts/defaultValues.ts";
import type { Settings, TooltipTheme } from "../../common/types/settings.ts";
import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";

export class SettingsService {
  static readonly SETTINGS_VERSION = 4;
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
        // Nothing awaits these handlers, so anything they throw has to be caught
        // here or it surfaces as an unhandled rejection in the service worker.
        void this.handleExtensionInstall();
      } else if (details.reason === "update") {
        void this.handleExtensionUpdate();
      }
    });
  }

  private async handleExtensionInstall() {
    try {
      const isAlreadyInstalled = await this.storageService.get("installedAt", "sync");
      if (isAlreadyInstalled) return;

      await this.initializeDefaultSettings();
      await this.initializeDefaultTooltipTheme();

      // Written last, and only once the settings actually landed: this is the
      // flag that stops the install from ever being redone, so recording it over
      // a failed write would leave the extension permanently unconfigured.
      const currentTime = Date.now();
      await this.storageService.setMany({ installedAt: currentTime, updatedAt: currentTime }, "sync");
    } catch (error) {
      console.error("Failed to set up the extension on install:", error);
    }

    this.openPopupOnInstall();
  }

  /**
   * Shows the popup once, as a welcome screen.
   *
   * Firefox MV3 and some Chrome builds only allow this from a user gesture and
   * reject; older ones do not expose `action.openPopup` at all and throw. Neither
   * is worth failing the install over, and neither is worth a console error the
   * viewer can do nothing about.
   */
  private openPopupOnInstall(): void {
    try {
      chrome.action?.openPopup?.()?.catch(() => { /* the browser declined to open it */ });
    } catch { /* the browser has no openPopup at all */ }
  }

  private async handleExtensionUpdate() {
    try {
      await this.migrateSettings();
      await this.migrateTooltipTheme();

      await this.storageService.set("updatedAt", Date.now(), "sync");
    } catch (error) {
      console.error("Failed to migrate the extension on update:", error);
    }
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
    
    await this.storageService.setMany({
      settings: migrated,
      settingsVersion: SettingsService.SETTINGS_VERSION,
    }, "sync");
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
 
    await this.storageService.setMany({
      tooltipTheme: migrated,
      tooltipThemeVersion: SettingsService.TOOLTIP_THEME_VERSION,
    }, "sync");
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
    await this.storageService.setMany({
      settings: initialSettings,
      settingsVersion: SettingsService.SETTINGS_VERSION,
    }, "sync");
  }

  private async initializeDefaultTooltipTheme() {
    await this.storageService.setMany({
      tooltipTheme: defaultTooltipTheme,
      tooltipThemeVersion: SettingsService.TOOLTIP_THEME_VERSION,
    }, "sync");
  }
}