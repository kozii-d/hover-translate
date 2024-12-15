import { SettingsManager } from "./managers/settingsManager.js";
import { TokenManager } from "./managers/tokenManager.js";

const main = () => {
  try {
    new TokenManager();
    new SettingsManager();
  } catch (error) {
    console.error(error);
  }
};

main();