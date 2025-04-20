export type Translator = "google" | "bing";

export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: Translator;
  useDictionary: boolean;
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