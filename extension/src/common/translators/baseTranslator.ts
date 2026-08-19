import { AvailableLanguages } from "../types/languages.ts";

export interface TranslatedData {
  detectedLanguageCode: string;
  translatedText: string;
  dictionary?: string;
  transliteration?: string;
  transcription?: string;
}

export abstract class BaseTranslator {
  abstract get name(): string;
  abstract get key(): string;

  /**
   * True when the translator talks to hosts that don't allow cross-origin
   * requests from the page, so its work has to run in the background service
   * worker (which host_permissions cover) instead of in the content script.
   */
  get needsBackgroundProxy(): boolean {
    return false;
  }

  abstract translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
  ): Promise<TranslatedData>;
  
  abstract getAvailableLanguages(): Promise<AvailableLanguages>;
}