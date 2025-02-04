// import { TokenService } from "./tokenService.ts";

import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";

export class MessageService {
  constructor(
    // private readonly tokenService: TokenService = new TokenService(),
  ) {
    this.setupMessageListeners();
  }

  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message,_ , sendResponse) => {
      // if (message.action === "restoreIdToken") {
      //   this.tokenService.restoreToken()
      //     .then(() => sendResponse({ success: true }))
      //     .catch((error) => sendResponse({ success: false, error: error?.message || "Unknown error" }));
      // }

      if (message.action === "openPopup") {
        chrome.action.openPopup()
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
      }
      
      if (message.action === "getAvailableLanguages") {
        const translator = TranslatorFactory.create(message.value);
        translator.getAvailableLanguages().then((availableLanguages) => {
          sendResponse({ availableLanguages });
        });
      }
      return true;
    });
  }
}