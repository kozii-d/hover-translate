import { GoogleTranslator } from "./google/google.ts";
import { BingTranslator } from "./bing/bing.ts";
import { DeepLTranslator } from "./deepl/deepl.ts";
import { BaseTranslator } from "./baseTranslator.ts";
import { ReplacementTranslator } from "./replacementTranslator.ts";
import { WITHDRAWN_TRANSLATORS } from "./withdrawnTranslators.ts";

const TRANSLATORS = {
  google: GoogleTranslator,
  bing: BingTranslator,
  deepl: DeepLTranslator,
} as const;

export class TranslatorFactory {
  static create(translatorKey: string): BaseTranslator {
    // A withdrawn translator stays selected in the synced settings until the
    // settings page is opened; until then its replacement answers, with the
    // selected languages carried over to its codes.
    const replacementKey = WITHDRAWN_TRANSLATORS[translatorKey];
    if (replacementKey) {
      return new ReplacementTranslator(TranslatorFactory.create(replacementKey));
    }

    const TranslatorClass = TRANSLATORS[translatorKey as keyof typeof TRANSLATORS];

    if (!TranslatorClass) {
      throw new Error(`Unknown translator: ${translatorKey}`);
    }

    return new TranslatorClass();
  }
}
