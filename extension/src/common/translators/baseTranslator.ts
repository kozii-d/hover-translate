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
   * worker, which may reach them once their host permission is granted,
   * instead of in the content script. Such hosts are optional permissions —
   * see "Browser differences" in CLAUDE.md.
   */
  get needsBackgroundProxy(): boolean {
    return false;
  }

  /**
   * True when the translator can use the caption line around the selection to
   * pick the meaning of an ambiguous word. Others are given no context, and
   * their cache keys stay what they were.
   */
  get supportsContext(): boolean {
    return false;
  }

  /**
   * `context` is the text around `text` — the caption the selection sits in —
   * which steers the translation but is not translated itself. Only passed to
   * translators that report `supportsContext`.
   */
  abstract translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
    context?: string,
  ): Promise<TranslatedData>;
  
  abstract getAvailableLanguages(): Promise<AvailableLanguages>;
}