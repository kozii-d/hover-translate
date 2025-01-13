import { AvailableLanguages } from "../types/languages.ts";

interface TranslatedData {
  detectedLanguageCode: string;
  translatedText: string;
}

export abstract class BaseTranslator {
  abstract translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ): Promise<TranslatedData>;
  
  abstract getAvailableLanguages(): Promise<AvailableLanguages>;
}