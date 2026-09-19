import { StorageService } from "./storageService.ts";

/**
 * Every API key the viewer has added, in `local` storage, as one object keyed
 * by translator: `{ deepl: "…" }`.
 *
 * One key for all of them rather than one storage key per provider, so that a
 * new translator that needs a key adds an entry here instead of another
 * top-level name, and everything that is a credential sits in one known place.
 *
 * Deliberately `local` and never `sync`: a key stays on the device it was
 * entered on and does not travel into the browser account's cloud copy.
 *
 * Only the background worker writes it, on the popup's `setApiKey` /
 * `removeApiKey` messages: `StorageService.update()` queues updates within one
 * JavaScript context, and two popup pages open at once are two contexts. The
 * popup and the translators only read.
 */
export const API_KEYS_STORAGE_KEY = "apiKeys";

export type StoredApiKeys = Partial<Record<string, string>>;

export class ApiKeyService {
  constructor(
    private readonly storageService: StorageService = new StorageService(),
  ) {}

  async getAll(): Promise<StoredApiKeys> {
    return (await this.storageService.get<StoredApiKeys>(API_KEYS_STORAGE_KEY, "local")) ?? {};
  }

  /** The key stored for a translator, or null when there is none. */
  async get(translatorKey: string): Promise<string | null> {
    const apiKey = (await this.getAll())[translatorKey]?.trim();
    return apiKey || null;
  }

  async set(translatorKey: string, apiKey: string): Promise<void> {
    await this.storageService.update<StoredApiKeys>(API_KEYS_STORAGE_KEY, "local", (apiKeys) => ({
      ...apiKeys,
      [translatorKey]: apiKey.trim(),
    }));
  }

  /** Drops the object altogether once the last key is gone. */
  async remove(translatorKey: string): Promise<void> {
    await this.storageService.update<StoredApiKeys>(API_KEYS_STORAGE_KEY, "local", (apiKeys) => {
      const remainingKeys = { ...apiKeys };
      delete remainingKeys[translatorKey];

      return Object.keys(remainingKeys).length ? remainingKeys : null;
    });
  }
}
