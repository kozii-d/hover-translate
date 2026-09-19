/**
 * Why a translator could not answer, in terms the viewer can act on.
 *
 * - `api-key-missing` / `api-key-invalid` — the translator needs the viewer's
 *   own key, and there is none or the service turned it down.
 * - `quota-exceeded` — the key has used up what its plan allows.
 * - `rate-limited` — too many requests in a short time; waiting helps.
 * - `permission-missing` — the browser does not let the extension reach the
 *   translator's host (an optional permission that was never granted, or was
 *   revoked since).
 * - `unsupported-language` — the service does not take the selected language.
 * - `network` — the service could not be reached at all.
 * - `service-unavailable` — the service answered, but with a server error.
 */
export type TranslatorErrorCode =
  | "api-key-missing"
  | "api-key-invalid"
  | "quota-exceeded"
  | "rate-limited"
  | "permission-missing"
  | "unsupported-language"
  | "network"
  | "service-unavailable";

export class TranslatorError extends Error {
  constructor(
    public readonly code: TranslatorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TranslatorError";
  }
}

export const isTranslatorError = (error: unknown): error is TranslatorError =>
  error instanceof TranslatorError;

/**
 * A failure as it travels between the background worker and its callers.
 *
 * The webextension-polyfill turns a rejected listener promise into a rejection
 * on the sender's side, but it only carries `message` across — the `code` that
 * tells a revoked key from a dropped connection would be lost on the way. So a
 * failing translator request is answered with this envelope instead, and the
 * caller turns it back into an error with `unwrapTranslatorResponse`.
 */
export interface TranslatorErrorResponse {
  translatorError: {
    code?: TranslatorErrorCode;
    message: string;
  };
}

export const serializeTranslatorError = (error: unknown): TranslatorErrorResponse => ({
  translatorError: {
    code: isTranslatorError(error) ? error.code : undefined,
    message: error instanceof Error && error.message ? error.message : String(error),
  },
});

const isTranslatorErrorResponse = (response: unknown): response is TranslatorErrorResponse =>
  typeof response === "object"
  && response !== null
  && "translatorError" in response;

/**
 * The background's answer to a translator request, or the error it reported —
 * a `TranslatorError` when it had a code, a plain `Error` otherwise.
 */
export const unwrapTranslatorResponse = <T>(response: T | TranslatorErrorResponse): T => {
  if (!isTranslatorErrorResponse(response)) {
    return response;
  }

  const { code, message } = response.translatorError;

  throw code ? new TranslatorError(code, message) : new Error(message);
};
