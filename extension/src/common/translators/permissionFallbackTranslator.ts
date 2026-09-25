import { BaseTranslator, TranslatedData } from "./baseTranslator.ts";
import { isTranslatorError } from "./translatorError.ts";
import { AvailableLanguages } from "../types/languages.ts";

/**
 * Translators whose host is an optional permission the viewer may not have
 * granted, each with the translator that answers until they do and the host
 * the viewer is told about.
 *
 * Bing, since 1.2.0: a viewer who had it selected in 1.1.14 (when Google stood
 * in for it) keeps it in the synced settings without access to www.bing.com —
 * Chrome dropped the host from the active permissions, and Firefox never had
 * it granted. Hovering keeps translating, through Google, instead of failing
 * on every word until they open the settings.
 */
export const PERMISSION_FALLBACKS: Partial<Record<string, { translatorKey: string; host: string }>> = {
  bing: { translatorKey: "google", host: "www.bing.com" },
};

export interface PermissionFallbackNotice {
  translatorName: string;
  host: string;
  fallbackTranslatorName: string;
}

/**
 * A translator as the page uses it when its host needs an optional permission:
 * every request goes to it first, and a `permission-missing` answer is
 * answered by the fallback instead — a `ReplacementTranslator`, so the
 * selected languages are carried over to the fallback's codes.
 *
 * Trying the translator first on every request is what brings it back as soon
 * as access is granted, with no reload: without the permission, the attempt
 * stops at the permission check and never reaches the network.
 *
 * `onFirstFallback` is called once per page, the first time the fallback
 * answers, so the viewer can be told why the translations come from another
 * translator — once per browser session, which `content.ts` settles with the
 * background.
 *
 * The key and name are the ones of whichever translator answered last, so
 * the cache is looked up under the one likely to answer; each translation
 * also carries its own in `answeredBy`, since requests overlap.
 */
export class PermissionFallbackTranslator extends BaseTranslator {
  private usingFallback = false;
  private fallbackAnnounced = false;

  constructor(
    private readonly translator: BaseTranslator,
    private readonly fallback: BaseTranslator,
    private readonly host: string,
    private readonly onFirstFallback: (notice: PermissionFallbackNotice) => void,
  ) {
    super();
  }

  private get active(): BaseTranslator {
    return this.usingFallback ? this.fallback : this.translator;
  }

  get name() {
    return this.active.name;
  }

  get key() {
    return this.active.key;
  }

  get supportsContext() {
    return this.active.supportsContext;
  }

  public async translate(
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string,
    signal?: AbortSignal,
    context?: string,
  ): Promise<TranslatedData> {
    try {
      const data = await this.translator.translate(text, sourceLanguageCode, targetLanguageCode, signal, context);
      this.usingFallback = false;

      return { ...data, answeredBy: { key: this.translator.key, name: this.translator.name } };
    } catch (error) {
      if (!isTranslatorError(error) || error.code !== "permission-missing") {
        throw error;
      }
    }

    this.usingFallback = true;

    if (!this.fallbackAnnounced) {
      this.fallbackAnnounced = true;
      this.onFirstFallback({
        translatorName: this.translator.name,
        host: this.host,
        fallbackTranslatorName: this.fallback.name,
      });
    }

    const data = await this.fallback.translate(text, sourceLanguageCode, targetLanguageCode, signal, context);

    return { ...data, answeredBy: { key: this.fallback.key, name: this.fallback.name } };
  }

  /** The translator's own lists: they need no permission. */
  public getAvailableLanguages(): Promise<AvailableLanguages> {
    return this.translator.getAvailableLanguages();
  }
}
