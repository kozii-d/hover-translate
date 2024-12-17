export interface Translation {
  id: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  translatedText: string;
  originalText: string;
  timestamp: number;
}