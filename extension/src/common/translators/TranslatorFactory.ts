import { GoogleTranslator } from "./google/google.ts";
import { BingTranslator } from "./bing/bing.ts";
import { DeepLTranslator } from "./deepl/deepl.ts";
import { BaseTranslator } from "./baseTranslator.ts";

const TRANSLATORS = {
  google: GoogleTranslator,
  bing: BingTranslator,
  deepl: DeepLTranslator,
} as const;

export class TranslatorFactory {
  static create(translatorKey: string): BaseTranslator {
    const TranslatorClass = TRANSLATORS[translatorKey as keyof typeof TRANSLATORS];

    if (!TranslatorClass) {
      throw new Error(`Unknown translator: ${translatorKey}`);
    }

    return new TranslatorClass();
  }
}