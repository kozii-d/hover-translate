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
    signal?: AbortSignal,
  ): Promise<TranslatedData> {
    const requestId = crypto.randomUUID();

    // Aborting the signal only detaches this caller: the work itself runs in the
    // service worker, which has to be told separately or the request goes
    // through to the translator in full — the pointer having long left the word.
    const handleAbort = () => {
      sendMessageToBackground({
        action: "abortTranslate",
        value: { requestId },
      })
        // The request may well have finished already; there is nothing to report.
        .catch(() => {});
    };

    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      return await sendMessageToBackground<TranslatedData>(
        {
          action: "translate",
          value: {
            requestId,
            translatorKey: this.key,
            text,
            sourceLanguageCode,
            targetLanguageCode,
          },
        },
        signal,
      );
    } finally {
      signal?.removeEventListener("abort", handleAbort);
    }
  }

  public async getAvailableLanguages(): Promise<AvailableLanguages> {
    const { availableLanguages } =
      await sendMessageToBackground<GetAvailableLanguagesResponse>({
        action: "getAvailableLanguages",
        value: this.key,
      });

    return availableLanguages;
  }
}
