import { BaseTranslator, TranslatedData } from "./baseTranslator.ts";
import { AvailableLanguages } from "../types/languages.ts";
import { GetAvailableLanguagesResponse } from "../types/messages.ts";
import { sendMessageToBackground } from "../services/messagingService.ts";

/**
 * Runs a translator's requests in the background service worker instead of in
 * the content script, for translators whose hosts don't allow cross-origin
 * requests from the page. The wrapped instance is only used for its identity.
 */
export class ProxyTranslator extends BaseTranslator {
  constructor(private readonly translator: BaseTranslator) {
    super();
  }

  get name() {
    return this.translator.name;
  }

  get key() {
    return this.translator.key;
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal
  ): Promise<TranslatedData> {
    return sendMessageToBackground<TranslatedData>({
      action: "translate",
      value: {
        translatorKey: this.key,
        text,
        sourceLanguageCode,
        targetLanguageCode,
      },
    }, signal);
  }

  public async getAvailableLanguages(): Promise<AvailableLanguages> {
    const { availableLanguages } = await sendMessageToBackground<GetAvailableLanguagesResponse>({
      action: "getAvailableLanguages",
      value: this.key,
    });

    return availableLanguages;
  }
}
