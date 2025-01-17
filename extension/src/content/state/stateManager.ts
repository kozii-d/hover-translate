import { Settings, TooltipTheme } from "../../common/types/settings.ts";
import { defaultSettings, defaultTooltipTheme } from "../../common/consts/defaultValues.ts";
import { StorageService } from "../../common/services/storageService.ts";

class StateManager {
  public settings: Settings;
  public tooltipTheme: TooltipTheme;
  public cacheLoaded: boolean;
  
  constructor(
    private readonly storageService: StorageService = new StorageService(),
  ) {
    this.settings = defaultSettings;
    this.tooltipTheme = defaultTooltipTheme;
    this.cacheLoaded = false;

    this.initializeSettings();
    this.checkStorageChanges();
  }

  initializeSettings() {
    this.storageService.get<Settings>("settings", "sync")
      .then((settings) => settings ? this.settings = settings : this.settings = defaultSettings);
    this.storageService.get<TooltipTheme>("tooltipTheme", "sync")
      .then((tooltipTheme) => tooltipTheme ? this.tooltipTheme = tooltipTheme : this.tooltipTheme = defaultTooltipTheme);
  }

  checkStorageChanges() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.settings) {
          this.settings = changes.settings.newValue as Settings;
        }
        if (changes.tooltipTheme) {
          this.tooltipTheme = changes.tooltipTheme.newValue as TooltipTheme;
        }
      }
    });
  }
}

export const state = new StateManager();