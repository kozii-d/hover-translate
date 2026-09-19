import { sendMessage } from "./sendMessage.ts";
import {
  TranslatorErrorResponse,
  unwrapTranslatorResponse,
} from "@extension/common/translators/translatorError.ts";
import { AvailableLanguages } from "@extension/common/types/languages.ts";
import { ApiKeyUsage, ApiKeyVerification } from "@extension/common/types/apiKeys.ts";

/**
 * The popup's translator requests to the background worker. A failure comes
 * back as a `TranslatorError` carrying its code (a rejected key, a missing
 * permission…), which is what lets the settings page say what went wrong and
 * what to do about it.
 */

export const requestAvailableLanguages = async (translatorKey: string): Promise<AvailableLanguages> => {
  const response = await sendMessage<{ availableLanguages: AvailableLanguages } | TranslatorErrorResponse>({
    action: "getAvailableLanguages",
    value: translatorKey,
  });

  return unwrapTranslatorResponse(response).availableLanguages;
};

export const requestApiKeyVerification = async (
  translatorKey: string,
  apiKey: string,
): Promise<ApiKeyVerification> => {
  const response = await sendMessage<ApiKeyVerification | TranslatorErrorResponse>({
    action: "verifyApiKey",
    value: { translatorKey, apiKey },
  });

  return unwrapTranslatorResponse(response);
};

/** Stores a key through the background worker, the only writer of `apiKeys`. */
export const requestApiKeySave = async (translatorKey: string, apiKey: string): Promise<void> => {
  const response = await sendMessage<{ success: true } | TranslatorErrorResponse>({
    action: "setApiKey",
    value: { translatorKey, apiKey },
  });

  unwrapTranslatorResponse(response);
};

export const requestApiKeyRemoval = async (translatorKey: string): Promise<void> => {
  const response = await sendMessage<{ success: true } | TranslatorErrorResponse>({
    action: "removeApiKey",
    value: { translatorKey },
  });

  unwrapTranslatorResponse(response);
};

export const requestApiKeyUsage = async (translatorKey: string): Promise<ApiKeyUsage> => {
  const response = await sendMessage<ApiKeyUsage | TranslatorErrorResponse>({
    action: "getApiKeyUsage",
    value: { translatorKey },
  });

  return unwrapTranslatorResponse(response);
};
