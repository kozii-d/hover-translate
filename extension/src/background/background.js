import { SettingsManager } from "./managers/settingsManager.js";
import { TokenManager } from "./managers/tokenManager.js";
import { StorageManager } from "./managers/storageManager.js";

const main = () => {
  try {
    const storageManager = new StorageManager();
    new TokenManager(storageManager);
    new SettingsManager(storageManager);
  } catch (error) {
    console.error(error);
  }
};

main();