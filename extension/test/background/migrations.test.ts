import { describe, expect, it } from "vitest";
import { SettingsMigrationsService } from "../../src/background/services/settingsMigrationsService.ts";
import { TooltipThemeMigrationsService } from "../../src/background/services/tooltipThemeMigrationsService.ts";
import { SettingsService } from "../../src/background/services/settingsService.ts";
import { defaultTooltipTheme } from "../../src/common/consts/defaultValues.ts";
import { Settings } from "../../src/common/types/settings.ts";

const TARGET = SettingsService.SETTINGS_VERSION;
const service = new SettingsMigrationsService();
const migrate = (settings: object | null, from: number, to = TARGET) =>
  service.migrate(settings as Settings | null, from, to);

/** Settings as version 1 wrote them: no translator yet. */
const version1 = { sourceLanguageCode: "auto", targetLanguageCode: "uk", autoPause: true };

/** Settings as the current version writes them, every field away from its default. */
const current: Settings = {
  sourceLanguageCode: "en",
  targetLanguageCode: "de",
  autoPause: false,
  translator: "bing",
  leftClickAction: "nothing",
  alwaysMultipleSelection: true,
  showNotifications: false,
};

describe("settings migrations", () => {
  it("the version this test knows is the current one", () => {
    // A new migration needs its cases here and in inferVersion.
    expect(TARGET).toBe(4);
  });

  it("nothing stored → nothing to migrate", () => {
    expect(migrate(null, 0)).toBeNull();
  });

  it("2 adds the translator", () => {
    expect(migrate(version1, 1, 2)).toEqual({ ...version1, translator: "google" });
  });

  it("3 adds the dictionary, multiple selection and notifications switches", () => {
    expect(migrate({ ...version1, translator: "bing" }, 2, 3)).toEqual({
      ...version1,
      translator: "bing",
      useDictionary: true,
      alwaysMultipleSelection: false,
      showNotifications: true,
    });
  });

  it("4 turns useDictionary into leftClickAction and removes it as undefined", () => {
    const fromTrue = migrate({ ...version1, translator: "google", useDictionary: true, alwaysMultipleSelection: false, showNotifications: true }, 3, 4);
    expect(fromTrue).toMatchObject({ leftClickAction: "save-to-dictionary" });
    expect(fromTrue).toHaveProperty("useDictionary", undefined);

    const fromFalse = migrate({ ...version1, translator: "google", useDictionary: false, alwaysMultipleSelection: false, showNotifications: true }, 3, 4);
    expect(fromFalse).toMatchObject({ leftClickAction: "copy-original" });
  });

  it("the whole chain from version 1", () => {
    expect(migrate(version1, 1)).toEqual({
      ...version1,
      translator: "google",
      useDictionary: undefined,
      alwaysMultipleSelection: false,
      showNotifications: true,
      leftClickAction: "save-to-dictionary",
    });
  });

  it("running twice gives the same result", () => {
    const once = migrate(version1, 0);
    expect(migrate(once, 0)).toEqual(once);
    expect(migrate(once, TARGET)).toEqual(once);
  });

  it("current settings without their version (sync delivered them apart): nothing is replayed", () => {
    // The same object: no migration ran over it. Replaying the chain from zero
    // used to reset the chosen translator to Google.
    expect(migrate(current, 0)).toBe(current);
  });

  it("a migration fills its fields and keeps any that arrived before it", () => {
    const early = { ...version1, translator: "bing", alwaysMultipleSelection: true };
    expect(migrate(early, 2, 3)).toEqual({ ...early, useDictionary: true, showNotifications: true });
  });

  it("a stored version behind its settings is a floor, not the truth", () => {
    const version3 = { ...version1, translator: "deepl", useDictionary: false, alwaysMultipleSelection: true, showNotifications: false };
    expect(migrate(version3, 1)).toEqual({ ...version3, useDictionary: undefined, leftClickAction: "copy-original" });
  });

  it.each<[string, object, number]>([
    ["leftClickAction", current, 4],
    ["showNotifications without leftClickAction", { ...version1, translator: "google", showNotifications: true }, 3],
    ["translator only", { ...version1, translator: "google" }, 2],
    ["none of them", version1, 0],
  ])("inferVersion: %s → %i", (_, settings, expected) => {
    expect(service.inferVersion(settings as Settings)).toBe(expected);
  });
});

describe("tooltip theme migrations", () => {
  const themeService = new TooltipThemeMigrationsService();

  it("nothing stored → nothing to migrate", () => {
    expect(themeService.migrate(null, 0, SettingsService.TOOLTIP_THEME_VERSION)).toBeNull();
  });

  it("a stored theme survives the chain, twice", () => {
    const theme = { ...defaultTooltipTheme, fontSize: "200%", useYouTubeSettings: false };
    const once = themeService.migrate(theme, 0, SettingsService.TOOLTIP_THEME_VERSION);
    expect(once).toEqual(theme);
    expect(themeService.migrate(once, 0, SettingsService.TOOLTIP_THEME_VERSION)).toEqual(theme);
  });
});
