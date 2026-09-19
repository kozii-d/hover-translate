import {
  TranslatorErrorCode,
  isTranslatorError,
} from "@extension/common/translators/translatorError.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The `settings` namespace key explaining each reason a translator can give. */
const REASON_KEYS: Record<TranslatorErrorCode, string> = {
  "api-key-missing": "errors.translator.apiKeyMissing",
  "api-key-invalid": "errors.translator.apiKeyInvalid",
  "quota-exceeded": "errors.translator.quotaExceeded",
  "rate-limited": "errors.translator.rateLimited",
  "permission-missing": "errors.translator.permissionMissing",
  "unsupported-language": "errors.translator.unsupportedLanguage",
  "network": "errors.translator.network",
  "service-unavailable": "errors.translator.serviceUnavailable",
};

/**
 * A sentence telling the viewer why the translator failed, or null when the
 * translator gave no reason — the caller then falls back to the raw message.
 * Takes the `settings` namespace's `t`.
 */
export const describeTranslatorError = (
  t: Translate,
  error: unknown,
  translatorName: string,
): string | null => {
  if (!isTranslatorError(error)) {
    return null;
  }

  return t(REASON_KEYS[error.code], { translatorName });
};

/**
 * Failures the viewer fixes in the API key form: no key, a rejected key, or a
 * host the browser was never allowed to reach.
 */
export const isApiKeyProblem = (error: unknown): boolean =>
  isTranslatorError(error)
  && (error.code === "api-key-missing"
    || error.code === "api-key-invalid"
    || error.code === "permission-missing");
