import {
  TranslatorErrorResponse,
  unwrapTranslatorResponse,
} from "@extension/common/translators/translatorError.ts";

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Sends a message to the background script and resolves with its reply.
 *
 * A handler that failed in the background answers with an error envelope
 * (`MessageService`), turned back into a rejection here, so a failing handler
 * surfaces as an error. The timeout covers the remaining case where nothing
 * answers at all — without it a caller waits forever, which is what used to
 * leave the settings page stuck on its skeleton.
 */
export const sendMessage = async <T>(
  message: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("The background script did not respond in time")),
      timeoutMs
    );
  });

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage<unknown, T | TranslatorErrorResponse | undefined>(message),
      timeout,
    ]);

    if (response === undefined) {
      throw new Error("The background script did not respond");
    }

    return unwrapTranslatorResponse(response);
  } finally {
    clearTimeout(timeoutId);
  }
};
