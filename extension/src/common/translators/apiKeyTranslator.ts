import { BaseTranslator } from "./baseTranslator.ts";
import { TranslatorError } from "./translatorError.ts";
import { ApiKeyService } from "../services/apiKeyService.ts";
import { StorageService } from "../services/storageService.ts";
import { AvailableLanguages } from "../types/languages.ts";
import { ApiKeyUsage, ApiKeyVerification } from "../types/apiKeys.ts";

/**
 * The last language lists each translator returned, in `local` storage, keyed
 * by translator: `{ deepl: { sourceLanguages, targetLanguages } }`. Used when
 * the service cannot be reached, so the settings page keeps working through a
 * network blip instead of throwing the viewer back to Google.
 */
export const TRANSLATOR_LANGUAGES_STORAGE_KEY = "translatorLanguages";

type StoredTranslatorLanguages = Partial<Record<string, AvailableLanguages>>;

/**
 * A translator that works with the viewer's own API key.
 *
 * The key lives in `ApiKeyService`, never in the settings, and is read on every
 * call: the background worker can be restarted at any moment, and a key that
 * was just changed in the popup must be used by the very next request.
 */
export abstract class ApiKeyTranslator extends BaseTranslator {
  constructor(
    protected readonly storageService: StorageService = new StorageService(),
    protected readonly apiKeyService: ApiKeyService = new ApiKeyService(storageService),
  ) {
    super();
  }

  get requiresApiKey(): boolean {
    return true;
  }

  /** How much of its allowance the key has used, the stored key by default. */
  abstract getUsage(apiKey?: string): Promise<ApiKeyUsage>;

  /**
   * Checks a key that has not been saved yet and returns what the settings page
   * needs to switch to it. Stores nothing: the popup saves the key only once
   * this has succeeded.
   */
  abstract verifyApiKey(apiKey: string): Promise<ApiKeyVerification>;

  protected async getStoredApiKey(): Promise<string> {
    const apiKey = await this.apiKeyService.get(this.key);

    if (!apiKey) {
      throw new TranslatorError("api-key-missing", `No ${this.name} API key has been added`);
    }

    return apiKey;
  }

  /**
   * Only a fallback for later; failing to write it must not fail the caller.
   * Only the background worker writes it.
   */
  protected cacheLanguages(availableLanguages: AvailableLanguages): void {
    this.storageService
      .update<StoredTranslatorLanguages>(TRANSLATOR_LANGUAGES_STORAGE_KEY, "local", (stored) => ({
        ...stored,
        [this.key]: availableLanguages,
      }))
      .catch((error) => console.warn(`Could not cache the ${this.name} languages`, error));
  }

  protected async getCachedLanguages(): Promise<AvailableLanguages | null> {
    try {
      const stored = await this.storageService.get<StoredTranslatorLanguages>(TRANSLATOR_LANGUAGES_STORAGE_KEY, "local");
      const languages = stored?.[this.key];

      return languages?.sourceLanguages?.length && languages.targetLanguages?.length
        ? languages
        : null;
    } catch {
      return null;
    }
  }
}

export const isApiKeyTranslator = (translator: BaseTranslator): translator is ApiKeyTranslator =>
  translator instanceof ApiKeyTranslator;
