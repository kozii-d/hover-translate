import { TranslatorFactory } from "../../common/translators/TranslatorFactory.ts";
import { BaseTranslator } from "../../common/translators/baseTranslator.ts";
import { ApiKeyTranslator, isApiKeyTranslator } from "../../common/translators/apiKeyTranslator.ts";
import { serializeTranslatorError } from "../../common/translators/translatorError.ts";
import { ApiKeyService } from "../../common/services/apiKeyService.ts";
import { ExtensionMessage } from "../../common/types/messages.ts";
import { getReviewPageUrl } from "../../common/ratingPrompt.ts";

/**
 * Runs a translator request and answers with its result, or with the error it
 * failed with in a form that survives the trip to the caller — see
 * `TranslatorErrorResponse`. Synchronous throws (an unknown translator key)
 * are caught the same way.
 */
const answerTranslatorRequest = <T>(request: () => Promise<T>) =>
  Promise.resolve()
    .then(request)
    .catch(serializeTranslatorError);

/**
 * The notices already shown in this browser session, `{ [noticeId]: true }` —
 * see `ClaimSessionNoticeMessage`. In `session` storage, which outlives
 * restarts of the background worker and is cleared when the browser closes.
 */
const SESSION_NOTICES_STORAGE_KEY = "shownSessionNotices";

const getSessionStorage = () => (chrome.storage as { session?: typeof chrome.storage.local }).session;

export class MessageService {
  // Translators keep short-lived credentials in memory, so the same instance is
  // reused instead of being rebuilt for every message.
  private readonly translators = new Map<string, BaseTranslator>();

  // Translations currently in flight for a content script, so that a hover which
  // ends before the answer arrives can stop the work rather than only stop
  // listening to it.
  private readonly activeTranslations = new Map<string, AbortController>();

  // The only writer of `apiKeys` — see `SetApiKeyMessage`.
  private readonly apiKeyService = new ApiKeyService();

  constructor() {
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

  private getApiKeyTranslator(translatorKey: string): ApiKeyTranslator {
    const translator = this.getTranslator(translatorKey);

    if (!isApiKeyTranslator(translator)) {
      throw new Error(`The ${translator.name} translator does not use an API key`);
    }

    return translator;
  }

  /** See `ClaimSessionNoticeMessage`. Without `storage.session`, every page shows its notice. */
  private async claimSessionNotice(noticeId: string): Promise<{ claimed: boolean }> {
    const session = getSessionStorage();
    if (!session) return { claimed: true };

    const shown: Partial<Record<string, boolean>> = (await session.get(SESSION_NOTICES_STORAGE_KEY))[SESSION_NOTICES_STORAGE_KEY] ?? {};
    if (shown[noticeId]) return { claimed: false };

    await session.set({ [SESSION_NOTICES_STORAGE_KEY]: { ...shown, [noticeId]: true } });
    return { claimed: true };
  }

  private setupMessageListeners(): void {
    // Answered through `sendResponse` and `return true`, which every Chrome and
    // Firefox accepts. Returning the promise itself is not enough: Chrome ignores
    // it before 147 (developer.chrome.com, "Message passing", says 148, rolling
    // out gradually), and the sender gets `undefined`. A handler that fails is answered with the same envelope
    // as a failing translator — `sendResponse` carries a value, not a rejection —
    // and the senders turn it back into an error (`unwrapTranslatorResponse`).
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      const reply = this.reply(message);
      if (!reply) return false;

      reply.catch(serializeTranslatorError).then(sendResponse);
      return true;
    });
  }

  /** The answer to a message, or `false` when this listener does not handle it. */
  private reply(message: ExtensionMessage): Promise<unknown> | false {
    if (message?.action === "getAvailableLanguages") {
      return answerTranslatorRequest(() => this.getTranslator(message.value)
        .getAvailableLanguages()
        .then((availableLanguages) => ({ availableLanguages })));
    }

    if (message?.action === "verifyApiKey") {
      const { translatorKey, apiKey } = message.value;

      return answerTranslatorRequest(() => this.getApiKeyTranslator(translatorKey).verifyApiKey(apiKey));
    }

    if (message?.action === "setApiKey") {
      const { translatorKey, apiKey } = message.value;

      return answerTranslatorRequest(() => this.apiKeyService.set(translatorKey, apiKey)
        .then(() => ({ success: true })));
    }

    if (message?.action === "removeApiKey") {
      return answerTranslatorRequest(() => this.apiKeyService.remove(message.value.translatorKey)
        .then(() => ({ success: true })));
    }

    if (message?.action === "getApiKeyUsage") {
      return answerTranslatorRequest(() => this.getApiKeyTranslator(message.value.translatorKey).getUsage());
    }

    if (message?.action === "translate") {
      const {
        requestId,
        translatorKey,
        text,
        sourceLanguageCode,
        targetLanguageCode,
        context,
      } = message.value;

      const abortController = new AbortController();
      this.activeTranslations.set(requestId, abortController);

      return answerTranslatorRequest(() => this.getTranslator(translatorKey)
        .translate(
          text,
          sourceLanguageCode,
          targetLanguageCode,
          abortController.signal,
          context,
        ))
        .finally(() => this.activeTranslations.delete(requestId));
    }

    if (message?.action === "hasPermissions") {
      return chrome.permissions.contains({ origins: message.value.origins })
        .then((granted) => ({ granted }));
    }

    if (message?.action === "claimSessionNotice") {
      return this.claimSessionNotice(message.value.noticeId);
    }

    if (message?.action === "openReviewPage") {
      const url = getReviewPageUrl(chrome.runtime.getURL(""), chrome.runtime.id);
      if (!url) return Promise.resolve({ success: false });

      return chrome.tabs.create({ url }).then(() => ({ success: true }));
    }

    if (message?.action === "abortTranslate") {
      // An unknown id means the request has already finished — or, in theory,
      // that the abort overtook it. Either way there is nothing left to stop.
      this.activeTranslations.get(message.value.requestId)?.abort();
      this.activeTranslations.delete(message.value.requestId);

      return Promise.resolve({ success: true });
    }

    return false;
  }
}
