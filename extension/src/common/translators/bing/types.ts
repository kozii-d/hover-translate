
export interface TokenData {
  token: string;
  expirationInMs: number;
}

export interface BingTokenPayload {
  region: string;
  "subscription-id": string;
  "product-id": string;
  "cognitive-services-endpoint": string;
  "azure-resource-id": string;
  scope: string;
  aud: string;
  exp: number;
  iss: string;
}

interface BingTranslation {
  detectedLanguage?: {
    language: string;
    score: number;
  },
  translations: {
    to: string;
    text: string;
    transliteration?: {
      script?: string;
      text?: string
    };
  }[];
}

export type BingTranslationResponse = BingTranslation[];

interface BingDictionaryTranslation {
  posTag: string
  displayTarget: string
  normalizedTarget: string
  prefixWord: string
  confidence: number
  backTranslations: {
    displayText: string
    normalizedText: string
    numExamples: number
    frequencyCount: number
  }[]
}

interface BingDictionary {
  displaySource: string
  normalizedSource: string
  translations: BingDictionaryTranslation[]
}

export type BingDictionaryResponse = BingDictionary[];

interface BingAvailableLanguages {
  name: string;
  nativeName: string;
  dir: string;
}

export interface BingAvailableLanguagesResponse {
  translation: Record<string, BingAvailableLanguages>
}