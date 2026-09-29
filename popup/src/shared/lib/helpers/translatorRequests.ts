import { sendMessage } from "./sendMessage.ts";
import { AvailableLanguages } from "@extension/common/types/languages.ts";
import { ApiKeyUsage, ApiKeyVerification } from "@extension/common/types/apiKeys.ts";

/**
 * The popup's translator requests to the background worker. A failure comes
 * back as a `TranslatorError` carrying its code (a rejected key, a missing
 * permission…), which is what lets the settings page say what went wrong and
 * what to do about it.
 */

export const requestAvailableLanguages = async (translatorKey: string): Promise<AvailableLanguages> => {
  const { availableLanguages } = await sendMessage<{ availableLanguages: AvailableLanguages }>({
    action: "getAvailableLanguages",
    value: translatorKey,
  });

  return availableLanguages;
};

export const requestApiKeyVerification = async (
  translatorKey: string,
  apiKey: string,
): Promise<ApiKeyVerification> => {
  return sendMessage<ApiKeyVerification>({
    action: "verifyApiKey",
    value: { translatorKey, apiKey },
  });
};

/** Stores a key through the background worker, the only writer of `apiKeys`. */
export const requestApiKeySave = async (translatorKey: string, apiKey: string): Promise<void> => {
  await sendMessage<{ success: true }>({
    action: "setApiKey",
    value: { translatorKey, apiKey },
  });
};

export const requestApiKeyRemoval = async (translatorKey: string): Promise<void> => {
  await sendMessage<{ success: true }>({
    action: "removeApiKey",
    value: { translatorKey },
  });
};

export const requestApiKeyUsage = async (translatorKey: string): Promise<ApiKeyUsage> => {
  return sendMessage<ApiKeyUsage>({
    action: "getApiKeyUsage",
    value: { translatorKey },
  });
};
