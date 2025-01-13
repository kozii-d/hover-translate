export interface Language {
  code: string;
  name: string;
}

export interface AvailableLanguages {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}