export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
}

export interface Language {
  code: string;
  name: string;
}

export interface LanguageResponse {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}