export type Translator = "google" | "bing";
export type LeftClickAction = "nothing" | "copy-original" | "copy-translation" | "save-to-dictionary";

export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: Translator;
  leftClickAction: LeftClickAction;
  alwaysMultipleSelection: boolean;
  showNotifications: boolean;
}

export interface Language {
  code: string;
  name: string;
}

export interface AvailableLanguages {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}