import { TooltipTheme } from "./settingsService.ts";

type TooltipThemeMigration = (oldTheme: TooltipTheme) => TooltipTheme;

export class TooltipThemeMigrationsService {
  private readonly tooltipThemeMigrations: Record<number, TooltipThemeMigration> = {
    // 2: (oldTheme) => ({
    //   ...oldTheme,
    //   newFeatureEnabled: true,
    // }),
  };

  /*
    * Migrate tooltip theme from one version to another.
   */
  public migrate(
    oldTheme: TooltipTheme | null,
    currentVersion: number,
    targetVersion: number
  ): TooltipTheme | null {

    if (!oldTheme) {
      return null;
    }

    let versionToMigrate = currentVersion;
    let newTheme = oldTheme;
    
    while (versionToMigrate < targetVersion) {
      const migration = this.tooltipThemeMigrations[versionToMigrate + 1];
      if (migration) {
        newTheme = migration(newTheme);
      }
      versionToMigrate++;
    }

    return newTheme;
  }
}