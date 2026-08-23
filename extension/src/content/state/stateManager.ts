import { Settings, TooltipTheme } from "../../common/types/settings.ts";
import { defaultSettings, defaultTooltipTheme } from "../../common/consts/defaultValues.ts";
import { StorageService } from "../../common/services/storageService.ts";

class StateManager {
  public settings: Settings;
  public tooltipTheme: TooltipTheme;

  private initialized = false;

  constructor(
    private readonly storageService: StorageService = new StorageService(),
  ) {
    this.settings = defaultSettings;
    this.tooltipTheme = defaultTooltipTheme;
  }

  /**
   * Reads the stored settings and starts following their changes.
   *
   * Kept out of the constructor because this module is imported by the whole
   * content pipeline, and the singleton is therefore created in every frame the
   * content script is injected into — including the ones that turn out to have
   * no player and build nothing. Those must not touch storage at all.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.initializeSettings();
    this.checkStorageChanges();
  }

  initializeSettings() {
    // A failed read leaves the defaults in place, which is the same outcome as an
    // empty storage — but without it the rejection had nowhere to go.
    this.storageService.get<Settings>("settings", "sync")
      .then((settings) => settings ? this.settings = settings : this.settings = defaultSettings)
      .catch((error) => console.error("Could not read the settings", error));
    this.storageService.get<TooltipTheme>("tooltipTheme", "sync")
      .then((tooltipTheme) => tooltipTheme ? this.tooltipTheme = tooltipTheme : this.tooltipTheme = defaultTooltipTheme)
      .catch((error) => console.error("Could not read the tooltip theme", error));
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