export class StorageManager {
  constructor(state) {
    this.state = state;
    this.initializeSettings();
    this.checkStorageChanges();
  }

  /**
   * @template T
   * @param key {string | null}
   * @param area {"sync" | "local"}
   * @returns {Promise<T>}
   */
  async get(key, area) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message || `Failed to get ${key || "data"} from ${area} storage.`));
        }

        if (key === null) {
          return resolve(result);
        }

        const data = result[key];

        if (!data) {
          return resolve(null);
        }

        resolve(data);
      });
    });
  }

  /**
   * @template T
   * @param key {string}
   * @param value {T}
   * @param area {"sync" | "local"}
   * @returns {Promise<void>}
   */
  async set(key, value, area) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError?.message || `Failed to save ${key} in ${area} storage.`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * @param key
   * @param area
   * @returns {Promise<unknown>}
   */
  async remove(key, area) {
    return new Promise((resolve, reject) => {
      chrome.storage[area].remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError?.message || `Failed to remove ${key} ${area} from storage.`));
        } else {
          resolve();
        }
      });
    });
  }

  initializeSettings() {
    this.get("settings", "sync").then((settings) => this.state.settings = settings);
    this.get("tooltipTheme", "sync").then((tooltipTheme) => this.state.tooltipTheme = tooltipTheme);
  }

  checkStorageChanges() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.settings) {
          this.state.settings = changes.settings.newValue;
        }
        if (changes.tooltipTheme) {
          this.state.tooltipTheme = changes.tooltipTheme.newValue;
        }
      }
    });
  }
}