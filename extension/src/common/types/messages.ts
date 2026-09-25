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
    /** The caption around `text`; only sent to translators that support it. */
    context?: string;
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

/**
 * Sent by a page whose translator answers through its fallback because a host
 * permission is missing (`PermissionFallbackTranslator`). Answered with
 * `{ claimed: true }` only for the first such page of the browser session, so
 * the viewer is told once rather than in every tab, reload and embedded player.
 */
export interface ClaimPermissionFallbackNoticeMessage {
  action: "claimPermissionFallbackNotice";
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
  | RemoveApiKeyMessage
  | ClaimPermissionFallbackNoticeMessage;

export interface GetAvailableLanguagesResponse {
  availableLanguages: AvailableLanguages;
}
