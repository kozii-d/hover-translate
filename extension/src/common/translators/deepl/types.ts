export interface DeepLTranslationResponse {
  translations: {
    detected_source_language?: string;
    text: string;
  }[];
}

export interface DeepLLanguage {
  language: string;
  name: string;
  supports_formality?: boolean;
}

export interface DeepLUsageResponse {
  character_count: number;
  character_limit: number;
}

/** The body DeepL sends along with an error status. */
export interface DeepLErrorResponse {
  message?: string;
  detail?: string;
}
