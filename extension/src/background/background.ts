import { SettingsService } from "./services/settingsService.ts";
import { MessageService } from "./services/messageService.ts";

const main = () => {
  try {
    new MessageService();
    new SettingsService();
  } catch (error) {
    console.error(error);
  }
};

main();