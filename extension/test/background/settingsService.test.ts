import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "../../src/background/services/settingsService.ts";
import { defaultSettings, defaultTooltipTheme } from "../../src/common/consts/defaultValues.ts";
import { FakeChromeOptions, installFakeChrome } from "../fakeChrome.ts";

const DAY = 24 * 60 * 60 * 1000;
const WELCOME_PAGE = "chrome-extension://jbddomeagbjjdoaehkdffdhifdhnmfic/popup/dist/welcome.html";

/** Starts the background's settings service in a profile, and fires `onInstalled`. */
const startBrowser = async (reason: "install" | "update", options: FakeChromeOptions = {}) => {
  const fake = installFakeChrome(options);
  new SettingsService();
  fake.fireInstalled({ reason });
  // Settled once the last key it writes is there.
  await vi.waitFor(() => expect(fake.storage.sync.updatedAt).not.toBe(options.sync?.updatedAt));
  return { fake };
};

describe("SettingsService: install", () => {
  it.each([
    ["pt-BR", "pt"], ["pt-PT", "pt-PT"], ["es-419", "es"], ["nn-NO", "no"], ["he", "iw"], ["ar", "ar"], ["en-US", "en"], ["xx", "en"],
  ])(
    "UI %j → target language %j, defaults for the rest", async (uiLanguage, target) => {
      const { fake } = await startBrowser("install", { uiLanguage });

      expect(fake.storage.sync).toMatchObject({
        settings: { ...defaultSettings, targetLanguageCode: target },
        settingsVersion: SettingsService.SETTINGS_VERSION,
        tooltipTheme: defaultTooltipTheme,
        tooltipThemeVersion: SettingsService.TOOLTIP_THEME_VERSION,
      });
      expect(fake.storage.sync.installedAt).toBe(fake.storage.sync.updatedAt);
    });

  it("opens the welcome page in a tab once, after the settings with the viewer's language are written", async () => {
    const { fake } = await startBrowser("install", { uiLanguage: "uk" });

    await vi.waitFor(() => expect(fake.createdTabs).toHaveLength(1));
    const [tab] = fake.createdTabs;
    expect(tab.url).toBe(WELCOME_PAGE);
    expect(tab.sync).toMatchObject({ settings: { ...defaultSettings, targetLanguageCode: "uk" }, tooltipTheme: defaultTooltipTheme });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.createdTabs).toHaveLength(1);
  });

  it("the settings that could not be written still open the page, which shows its error screen", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = installFakeChrome({ failingWrites: { sync: ["settings"] } });
    new SettingsService();

    fake.fireInstalled({ reason: "install" });

    await vi.waitFor(() => expect(fake.createdTabs.map(({ url }) => url)).toEqual([WELCOME_PAGE]));
    expect(fake.createdTabs[0].sync).toEqual({});
    expect(consoleError).toHaveBeenCalledWith("Failed to set up the extension on install:", expect.any(Error));
  });

  it("the browser refusing the tab is logged: no unhandled rejection, the install is complete", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { fake } = await startBrowser("install", { refuseTabs: true });

      await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith("Failed to open the welcome page:", expect.any(Error)));
      expect(fake.createdTabs).toEqual([]);
      expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "en" });
      // A rejection nobody handles is reported after the microtasks of its turn.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      consoleError.mockRestore();
    }
  });

  it("a profile that has installedAt already (sync from another device) is not set up again", async () => {
    const sync = { installedAt: 1, settings: { ...defaultSettings, translator: "bing" } };
    const fake = installFakeChrome({ sync, uiLanguage: "de" });
    new SettingsService();

    fake.fireInstalled({ reason: "install" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fake.storage.sync).toEqual(sync);
    // The viewer knows the extension already: no welcome page.
    expect(fake.createdTabs).toEqual([]);
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
    expect(fake.createdTabs).toEqual([]);
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

describe("SettingsService: the page opened after the extension is removed", () => {
  it("every start of the worker sets it, the same address and nothing in it, whatever the start", async () => {
    const fake = installFakeChrome();
    new SettingsService();
    expect(fake.uninstallURLs).toEqual(["https://hovertranslate.app/uninstall/"]);

    // Not tied to onInstalled: an install or an update starts the worker once, and it is set once.
    for (const reason of ["install", "update"] as const) {
      const { fake } = await startBrowser(reason);
      expect(fake.uninstallURLs).toEqual(["https://hovertranslate.app/uninstall/"]);
    }
  });

  it("the browser refusing it is logged, and the worker goes on: no unhandled rejection, the install still runs", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { fake } = await startBrowser("install", { refuseUninstallURL: true });

      expect(fake.uninstallURLs).toEqual([]);
      expect(fake.storage.sync.settings).toEqual({ ...defaultSettings, targetLanguageCode: "en" });
      expect(consoleError).toHaveBeenCalledWith("Failed to set the page opened on uninstall:", expect.any(Error));
      // A rejection nobody handles is reported after the microtasks of its turn.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      consoleError.mockRestore();
    }
  });
});
