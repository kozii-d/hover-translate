
export interface BingCredentials {
  ig: string;
  iid: string;
  key: number;
  token: string;
  expiresAtMs: number;
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

/**
 * Bing answers with HTTP 200 and one of these envelopes when the anti-abuse
 * credentials went stale or the request was flagged.
 */
export interface BingErrorResponse {
  statusCode?: number;
  errorMessage?: string;
  ShowCaptcha?: boolean;
}

interface BingAvailableLanguages {
  name: string;
  nativeName: string;
  dir: string;
}

export interface BingAvailableLanguagesResponse {
  translation: Record<string, BingAvailableLanguages>
}
