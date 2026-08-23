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

export type ExtensionMessage =
  | OpenPopupMessage
  | GetAvailableLanguagesMessage
  | TranslateMessage
  | AbortTranslateMessage;

export interface GetAvailableLanguagesResponse {
  availableLanguages: AvailableLanguages;
}
