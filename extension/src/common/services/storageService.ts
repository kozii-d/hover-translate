export class StorageService {
  /**
   * The update in progress for each `area:key`, shared by every instance in
   * this JavaScript context — see `update()`.
   */
  private static readonly pendingUpdates = new Map<string, Promise<void>>();

  async get<T>(key: string | null, area: "sync" | "local"): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          return reject(
            new Error(
              chrome.runtime.lastError.message ||
                `Failed to get ${key || "data"} from ${area} storage.`,
            ),
          );
        }

        if (key === null) {
          return resolve(result as T);
        }

        const data = result[key];

        if (!data) {
          return resolve(null);
        }

        resolve(data as T);
      });
    });
  }

  async set<T>(key: string, value: T, area: "sync" | "local"): Promise<void> {
    return this.setMany({ [key]: value }, area);
  }

  /**
   * Stores several keys in one operation.
   *
   * Values that only make sense together — a migrated object and the version
   * number describing it — have to be written this way. Two separate `set` calls
   * can land one and drop the other, and a settings object stored without its
   * version makes the next update replay every migration over it.
   */
  async setMany(
    items: Record<string, unknown>,
    area: "sync" | "local",
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      chrome.storage[area].set(items, () => {
        if (chrome.runtime.lastError) {
          const keys = Object.keys(items).join(", ");
          reject(
            new Error(
              chrome.runtime.lastError?.message ||
                `Failed to save ${keys} in ${area} storage.`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Replaces a stored value with what `updater` makes of it; returning null
   * removes the key.
   *
   * For values several callers change at once — one object holding an entry
   * per translator. A plain get-then-set lets two overlapping updates both
   * read the old object, and the second write silently drops the first
   * entry. Updates to the same key are queued behind each other, which covers
   * every caller in this context; it relies on each such key having a single
   * writing context — the background worker, for both `apiKeys` and
   * `translatorLanguages`.
   */
  async update<T>(
    key: string,
    area: "sync" | "local",
    updater: (current: T | null) => T | null,
  ): Promise<void> {
    const id = `${area}:${key}`;
    const previous = StorageService.pendingUpdates.get(id) ?? Promise.resolve();

    const next = previous
      // A failed update must not block the ones queued behind it.
      .catch(() => {})
      .then(async () => {
        const value = updater(await this.get<T>(key, area));

        if (value === null) {
          await this.remove(key, area);
        } else {
          await this.set(key, value, area);
        }
      });

    StorageService.pendingUpdates.set(id, next);

    try {
      await next;
    } finally {
      if (StorageService.pendingUpdates.get(id) === next) {
        StorageService.pendingUpdates.delete(id);
      }
    }
  }

  async remove(key: string, area: "sync" | "local"): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      chrome.storage[area].remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError?.message ||
                `Failed to remove ${key} from ${area} storage.`,
            ),
          );
        } else {
          resolve();
        }
      });
    });
  }
}
