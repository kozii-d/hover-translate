// import { TokenService } from "./tokenService.ts";

import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";
import { ExtensionMessage } from "../../common/types/messages.ts";

export class MessageService {
  // Translators keep short-lived credentials in memory, so the same instance is
  // reused instead of being rebuilt for every message.
  private readonly translators = new Map<string, BaseTranslator>();

  constructor(
    // private readonly tokenService: TokenService = new TokenService(),
  ) {
    this.setupMessageListeners();
  }

  private getTranslator(translatorKey: string): BaseTranslator {
    const cachedTranslator = this.translators.get(translatorKey);
    if (cachedTranslator) {
      return cachedTranslator;
    }

    const translator = TranslatorFactory.create(translatorKey);
    this.translators.set(translatorKey, translator);

    return translator;
  }

  private setupMessageListeners(): void {
    // Returning a promise is the webextension-polyfill contract: it forwards the
    // resolved value to the sender and — the part the callback style used to drop
    // — turns a rejection into a rejection on the sender's side, so a failing
    // translator reports an error instead of leaving the caller waiting forever.
    chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
      // if (message.action === "restoreIdToken") {
      //   return this.tokenService.restoreToken().then(() => ({ success: true }));
      // }

      if (message?.action === "openPopup") {
        return chrome.action
          .openPopup()
          .then(() => ({ success: true }))
          .catch(() => ({ success: false }));
      }

      if (message?.action === "getAvailableLanguages") {
        return this.getTranslator(message.value)
          .getAvailableLanguages()
          .then((availableLanguages) => ({ availableLanguages }));
      }

      if (message?.action === "translate") {
        const { translatorKey, text, sourceLanguageCode, targetLanguageCode } =
          message.value;

        return this.getTranslator(translatorKey).translate(
          text,
          sourceLanguageCode,
          targetLanguageCode,
        );
      }

      return false;
    });
  }
}
