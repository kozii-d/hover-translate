import { BaseTranslator, TranslatedData } from "./baseTranslator.ts";
import { matchSelectedLanguages } from "./findClosestLanguage.ts";
import { defaultSettings } from "../consts/defaultValues.ts";
import { AvailableLanguages } from "../types/languages.ts";

/**
 * Answers for a withdrawn translator (see `WITHDRAWN_TRANSLATORS`) until the
 * viewer opens the settings, which move them to the replacement for good.
 *
 * Until then the settings keep the withdrawn translator's language codes, and
 * the replacement may not take them: Google answers 400 to Bing's `prs`, `lzh`
 * or `tlh-Latn`. Each request is carried over to the replacement's codes by
 * the rule the settings page applies when it switches translators, so a hover
 * translates into the language the settings page will then save.
 */
export class ReplacementTranslator extends BaseTranslator {
  private availableLanguages: Promise<AvailableLanguages> | null = null;

  constructor(private readonly translator: BaseTranslator) {
    super();
  }

  get name() {
    return this.translator.name;
  }

  get key() {
    return this.translator.key;
  }

  get needsBackgroundProxy() {
    return this.translator.needsBackgroundProxy;
  }

  get supportsContext() {
    return this.translator.supportsContext;
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
    context?: string,
  ): Promise<TranslatedData> {
    const languages = matchSelectedLanguages(
      { sourceLanguageCode, targetLanguageCode },
      await this.getAvailableLanguages(),
      chrome.i18n.getUILanguage(),
      defaultSettings.targetLanguageCode,
    );

    return this.translator.translate(
      text,
      languages.sourceLanguageCode,
      languages.targetLanguageCode,
      signal,
      context,
    );
  }

  public getAvailableLanguages(): Promise<AvailableLanguages> {
    // Asked once: every hover needs the lists, and a failure is asked again.
    this.availableLanguages ??= this.translator.getAvailableLanguages().catch((error) => {
      this.availableLanguages = null;
      throw error;
    });

    return this.availableLanguages;
  }
}
