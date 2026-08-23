export class StorageService {
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
