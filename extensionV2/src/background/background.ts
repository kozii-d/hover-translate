import { TokenService } from "./services/tokenService.ts";
import { SettingsService } from "./services/settingsService.ts";

const main = () => {
  try {
    new TokenService();
    new SettingsService();
  } catch (error) {
    console.error(error);
  }
};

main();