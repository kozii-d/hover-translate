export type Translator = "google" | "bing";

export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: Translator;
}

export interface Language {
  code: string;
  name: string;
}

export interface AvailableLanguages {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}