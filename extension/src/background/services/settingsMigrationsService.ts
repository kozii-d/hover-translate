import { LeftClickAction, Settings } from "../../common/types/settings.ts";

type SettingsMigration = (oldSettings: Settings) => Settings;

/**
 * A field that only exists in settings written before migration 4, kept as a
 * type so the migrations can read it without an escape hatch at every use.
 */
type LegacySettings = Settings & { useDictionary?: boolean };

export class SettingsMigrationsService {
  /**
   * Each migration introduces the fields its version added, and introduces them
   * only where they are missing.
   *
   * Filling rather than overwriting is what makes a migration safe to run twice.
   * The stored version number is not trustworthy — `chrome.storage.sync`
   * propagates keys independently, so a new device can receive `settings` before
   * `settingsVersion` — and a chain replayed from zero over already-current
   * settings used to reset the chosen translator to Google, switch notifications
   * back on and discard the chosen click action.
   *
   * For settings that genuinely are old the fields really are missing, so the
   * outcome is exactly what unconditional assignment produced.
   *
   * **Write every new migration this way.** A migration that renames or
   * recomputes a field instead of filling it brings the whole problem back.
   */
  private readonly settingsMigrations: Record<number, SettingsMigration> = {
    2: (oldSettings) => ({
      ...oldSettings,
      translator: oldSettings.translator ?? "google",
    }),
    3: (oldSettings) => {
      const legacy = oldSettings as LegacySettings;

      return {
        ...oldSettings,
        useDictionary: legacy.useDictionary ?? true,
        alwaysMultipleSelection: oldSettings.alwaysMultipleSelection ?? false,
        showNotifications: oldSettings.showNotifications ?? true,
      } as Settings;
    },
    4: (oldSettings) => {
      const legacy = oldSettings as LegacySettings;

      // NOTE: useDictionary - outdated, replaced by leftClickAction
      const fromDictionary: LeftClickAction = legacy.useDictionary
        ? "save-to-dictionary"
        : "copy-original";

      return {
        ...oldSettings,
        leftClickAction: oldSettings.leftClickAction ?? fromDictionary,
        useDictionary: undefined,
      } as Settings;
    },
  };

  /*
   * Migrate settings from one version to another.
   */
  public migrate(
    oldSettings: Settings | null,
    currentVersion: number,
    targetVersion: number,
  ): Settings | null {
    if (!oldSettings) {
      return null;
    }

    // The stored number is a floor, not the truth: it can be missing entirely or
    // lag behind the settings it describes.
    let versionToMigrate = Math.max(
      currentVersion,
      this.inferVersion(oldSettings),
    );
    let newSettings = oldSettings;

    while (versionToMigrate < targetVersion) {
      const migration = this.settingsMigrations[versionToMigrate + 1];
      if (migration) {
        newSettings = migration(newSettings);
      }
      versionToMigrate++;
    }

    return newSettings;
  }

  /**
   * The version a settings object is already at, judged by which fields it
   * carries.
   *
   * `settingsVersion` can be absent while `settings` is present — it was written
   * as a separate operation until this release, the popup writes settings without
   * it, and sync delivers the two keys independently. Reading that as version 0
   * replays the whole chain over settings that are already current.
   *
   * **Add a case here whenever a migration introduces a field**, or a profile
   * carrying that field will be read as the version below it.
   */
  public inferVersion(settings: Settings): number {
    if (settings.leftClickAction !== undefined) return 4;
    if (settings.showNotifications !== undefined) return 3;
    if (settings.translator !== undefined) return 2;

    return 0;
  }
}
