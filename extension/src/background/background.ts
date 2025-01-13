// import { TokenService } from "./services/tokenService.ts";
import { SettingsService } from "./services/settingsService.ts";
import { GoogleTranslator } from "../common/translators/google/google.ts";
import { MessageService } from "./services/messageService.ts";

const main = () => {
  try {
    // new TokenService();
    const translator = new GoogleTranslator();
    new MessageService(translator);
    new SettingsService(translator);
  } catch (error) {
    console.error(error);
  }
};

main();