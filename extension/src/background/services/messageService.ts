// import { TokenService } from "./tokenService.ts";

import { BaseTranslator } from "../../common/translators/baseTranslator.ts";

export class MessageService {
  constructor(
    // private readonly tokenService: TokenService = new TokenService(),
    private readonly translator: BaseTranslator
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
        this.translator.getAvailableLanguages().then((availableLanguages) => {
          sendResponse({ availableLanguages });
        });
      }
      return true;
    });
  }
}