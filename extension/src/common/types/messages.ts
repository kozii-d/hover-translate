import { AvailableLanguages } from "./languages.ts";

export interface OpenPopupMessage {
  action: "openPopup";
}

export interface GetAvailableLanguagesMessage {
  action: "getAvailableLanguages";
  value: string;
}

export interface TranslateMessage {
  action: "translate";
  value: {
    /** Identifies this request so that it can be aborted while it runs. */
    requestId: string;
    translatorKey: string;
    text: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
  };
}

export interface AbortTranslateMessage {
  action: "abortTranslate";
  value: {
    requestId: string;
  };
}

/**
 * Checks an API key the viewer has typed in but not saved yet. Answered with
 * an `ApiKeyVerification`.
 */
export interface VerifyApiKeyMessage {
  action: "verifyApiKey";
  value: {
    translatorKey: string;
    apiKey: string;
  };
}

/** How much of the stored key's allowance is used. Answered with an `ApiKeyUsage`. */
export interface GetApiKeyUsageMessage {
  action: "getApiKeyUsage";
  value: {
    translatorKey: string;
  };
}

/**
 * Stores or removes an API key. The popup never writes `apiKeys` itself: the
 * background worker is its only writer, so updates from any number of open
 * popup pages go through one queue. Answered with `{ success: true }`.
 */
export interface SetApiKeyMessage {
  action: "setApiKey";
  value: {
    translatorKey: string;
    apiKey: string;
  };
}

export interface RemoveApiKeyMessage {
  action: "removeApiKey";
  value: {
    translatorKey: string;
  };
}

export type ExtensionMessage =
  | OpenPopupMessage
  | GetAvailableLanguagesMessage
  | TranslateMessage
  | AbortTranslateMessage
  | VerifyApiKeyMessage
  | GetApiKeyUsageMessage
  | SetApiKeyMessage
  | RemoveApiKeyMessage;

export interface GetAvailableLanguagesResponse {
  availableLanguages: AvailableLanguages;
}
