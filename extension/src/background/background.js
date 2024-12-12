import { LanguageManager } from "./managers/languageManager.js";
import { TokenManager } from "./managers/tokenManager.js";

const main = () => {
  try {
    const tokenManager = new TokenManager();
    new LanguageManager(tokenManager);
  } catch (error) {
    console.error(error);
  }
};

main();