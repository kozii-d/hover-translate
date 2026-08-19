import { ExtensionMessage } from "../types/messages.ts";

const DEFAULT_TIMEOUT_MS = 20_000;

const createAbortError = () => {
  const error = new Error("The request was aborted");
  error.name = "AbortError";
  return error;
};

/**
 * Sends a message to the background service worker and resolves with its reply.
 *
 * The webextension-polyfill turns a rejection thrown by the background listener
 * into a rejection here, so failures surface to the caller. The timeout covers
 * the remaining case where nothing answers at all (a listener that never
 * responds would otherwise leave the caller waiting forever).
 */
export const sendMessageToBackground = async <T>(
  message: ExtensionMessage,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> => {
  if (signal?.aborted) {
    throw createAbortError();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let handleAbort: (() => void) | undefined;

  // The background never sees the AbortSignal, so aborting only detaches this
  // caller — a response that arrives afterwards is simply discarded.
  const failEarly = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(
          new Error(
            `The background script did not respond to "${message.action}" in time`,
          ),
        ),
      timeoutMs,
    );

    handleAbort = () => reject(createAbortError());
    signal?.addEventListener("abort", handleAbort, { once: true });
  });

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage<ExtensionMessage, T | undefined>(message),
      failEarly,
    ]);

    if (response === undefined) {
      throw new Error(
        `The background script did not handle "${message.action}"`,
      );
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
    if (handleAbort) {
      signal?.removeEventListener("abort", handleAbort);
    }
  }
};
