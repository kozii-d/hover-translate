export interface TranslationCacheData {
  originalText: string; // Original text to be translated
  sourceLanguageCode: string; // Language code of the source text (e.g., "en")
  targetLanguageCode: string; // Language code of the target text (e.g., "uk")
  translatedText: string; // Translated text
  dictionary?: string; // Dictionary string data
  transliteration?: string; // Transliteration string
  transcription?: string; // Transcription string
  translatorName: string; // Name of the translator
}

export interface TranslationData extends TranslationCacheData {
  id: string; // Unique identifier for the translation
  timestamp: number; // Timestamp (in milliseconds since epoch)
}