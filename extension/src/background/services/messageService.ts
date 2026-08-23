// import { TokenService } from "./tokenService.ts";

import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";
import { ExtensionMessage } from "../../common/types/messages.ts";

export class MessageService {
  // Translators keep short-lived credentials in memory, so the same instance is
  // reused instead of being rebuilt for every message.
  private readonly translators = new Map<string, BaseTranslator>();

  // Translations currently in flight for a content script, so that a hover which
  // ends before the answer arrives can stop the work rather than only stop
  // listening to it.
  private readonly activeTranslations = new Map<string, AbortController>();

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
        const {
          requestId,
          translatorKey,
          text,
          sourceLanguageCode,
          targetLanguageCode,
        } = message.value;

        const abortController = new AbortController();
        this.activeTranslations.set(requestId, abortController);

        return this.getTranslator(translatorKey)
          .translate(
            text,
            sourceLanguageCode,
            targetLanguageCode,
            abortController.signal,
          )
          .finally(() => this.activeTranslations.delete(requestId));
      }

      if (message?.action === "abortTranslate") {
        // An unknown id means the request has already finished — or, in theory,
        // that the abort overtook it. Either way there is nothing left to stop.
        this.activeTranslations.get(message.value.requestId)?.abort();
        this.activeTranslations.delete(message.value.requestId);

        return Promise.resolve({ success: true });
      }

      return false;
    });
  }
}
