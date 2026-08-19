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
    translatorKey: string;
    text: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
  };
}

export type ExtensionMessage =
  | OpenPopupMessage
  | GetAvailableLanguagesMessage
  | TranslateMessage;

export interface GetAvailableLanguagesResponse {
  availableLanguages: AvailableLanguages;
}
