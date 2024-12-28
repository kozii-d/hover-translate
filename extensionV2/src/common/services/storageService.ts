export class StorageService {
  async get<T>(key: string | null, area: "sync" | "local"): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message || `Failed to get ${key || "data"} from ${area} storage.`));
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
    return new Promise<void>((resolve, reject) => {
      chrome.storage[area].set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError?.message || `Failed to save ${key} in ${area} storage.`));
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
          reject(new Error(chrome.runtime.lastError?.message || `Failed to remove ${key} from ${area} storage.`));
        } else {
          resolve();
        }
      });
    });
  }
}