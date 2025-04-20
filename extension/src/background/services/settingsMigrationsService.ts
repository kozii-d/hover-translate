import { Settings } from "../../common/types/settings.ts";

type SettingsMigration = (oldSettings: Settings) => Settings;

export class SettingsMigrationsService {
  private readonly settingsMigrations: Record<number, SettingsMigration> = {
    2: (oldSettings) => ({
      ...oldSettings,
      translator: "google",
    }),
    3: (oldSettings) => ({
      ...oldSettings,
      useDictionary: true,
      alwaysMultipleSelection: false,
      showNotifications: true,
    }),
  };

  /*
    * Migrate settings from one version to another.
   */
  public migrate(
    oldSettings: Settings | null,
    currentVersion: number,
    targetVersion: number
  ): Settings | null {

    if (!oldSettings) {
      return null;
    }

    let versionToMigrate = currentVersion;
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
}