// import { TokenService } from "./services/tokenService.ts";
import { SettingsService } from "./services/settingsService.ts";
import { MessageService } from "./services/messageService.ts";

const main = () => {
  try {
    // new TokenService();

    new MessageService();
    new SettingsService();
  } catch (error) {
    console.error(error);
  }
};

main();