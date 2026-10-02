import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../../src/background/services/settingsService.ts";
import { defaultSettings, defaultTooltipTheme } from "../../src/common/consts/defaultValues.ts";
import { FakeChromeOptions, installFakeChrome } from "../fakeChrome.ts";

const DAY = 24 * 60 * 60 * 1000;

/** Starts the background's settings service in a profile, and fires `onInstalled`. */
const startBrowser = async (reason: "install" | "update", options: FakeChromeOptions = {}) => {
  const fake = installFakeChrome(options);
  const openPopup = vi.spyOn(chrome.action, "openPopup");
  new SettingsService();
  fake.fireInstalled({ reason });
  // Settled once the last key it writes is there.
  await vi.waitFor(() => expect(fake.storage.sync.updatedAt).not.toBe(options.sync?.updatedAt));
  return { fake, openPopup };
};

describe("SettingsService: install", () => {
  it.each([
    ["pt-BR", "pt"], ["pt-PT", "pt-PT"], ["es-419", "es"], ["nn-NO", "no"], ["he", "iw"], ["ar", "ar"], ["en-US", "en"], ["xx", "en"],
  ])(
    "UI %j → target language %j, defaults for the rest", async (uiLanguage, target) => {
      const { fake, openPopup } = await startBrowser("install", { uiLanguage });

      expect(fake.storage.sync).toMatchObject({
        settings: { ...defaultSettings, targetLanguageCode: target },
        settingsVersion: SettingsService.SETTINGS_VERSION,
        tooltipTheme: defaultTooltipTheme,
        tooltipThemeVersion: SettingsService.TOOLTIP_THEME_VERSION,
      });
      expect(fake.storage.sync.installedAt).toBe(fake.storage.sync.updatedAt);
      expect(openPopup).toHaveBeenCalledOnce();
    });

  it("a profile that has installedAt already (sync from another device) is not set up again", async () => {
    const sync = { installedAt: 1, settings: { ...defaultSettings, translator: "bing" } };
    const fake = installFakeChrome({ sync, uiLanguage: "de" });
    new SettingsService();

    fake.fireInstalled({ reason: "install" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fake.storage.sync).toEqual(sync);
  });
});

describe("SettingsService: update", () => {
  it("migrates the stored settings and records updatedAt; installedAt stays", async () => {
    const installedAt = Date.now() - 100 * DAY;
    const { fake } = await startBrowser("update", {
      sync: {
        installedAt,
        updatedAt: installedAt,
        settings: { sourceLanguageCode: "auto", targetLanguageCode: "uk", autoPause: true, translator: "google", useDictionary: false },
        settingsVersion: 2,
        tooltipTheme: { ...defaultTooltipTheme, fontSize: "150%" },
        tooltipThemeVersion: 1,
      },
    });

    expect(fake.storage.sync.settings).toEqual({
      sourceLanguageCode: "auto",
      targetLanguageCode: "uk",
      autoPause: true,
      translator: "google",
      alwaysMultipleSelection: false,
      showNotifications: true,
      leftClickAction: "copy-original",
    });
    expect(fake.storage.sync.settingsVersion).toBe(SettingsService.SETTINGS_VERSION);
    expect(fake.storage.sync.tooltipTheme).toEqual({ ...defaultTooltipTheme, fontSize: "150%" });
    expect(fake.storage.sync.installedAt).toBe(installedAt);
    expect(fake.storage.sync.updatedAt).toBeGreaterThan(installedAt);
  });

  it("current settings that arrived without their version keep the chosen translator", async () => {
    const settings = { ...defaultSettings, translator: "deepl", leftClickAction: "nothing", showNotifications: false };
    const { fake } = await startBrowser("update", { sync: { installedAt: 1, updatedAt: 1, settings } });

    expect(fake.storage.sync.settings).toEqual(settings);
  });

  it("no settings at all: the initial ones, with the viewer's language", async () => {
    const { fake } = await startBrowser("update", { uiLanguage: "uk", sync: { installedAt: 1, updatedAt: 1 } });

    expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "uk" });
    expect(fake.storage.sync.tooltipTheme).toEqual(defaultTooltipTheme);
  });
});
