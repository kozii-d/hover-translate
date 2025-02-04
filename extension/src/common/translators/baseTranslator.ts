import { AvailableLanguages } from "../types/languages.ts";

interface TranslatedData {
  detectedLanguageCode: string;
  translatedText: string;
  dictionary?: string;
  transliteration?: string;
  transcription?: string;
}

export abstract class BaseTranslator {
  abstract get name(): string;
  abstract get key(): string;

  abstract translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ): Promise<TranslatedData>;
  
  abstract getAvailableLanguages(): Promise<AvailableLanguages>;
}