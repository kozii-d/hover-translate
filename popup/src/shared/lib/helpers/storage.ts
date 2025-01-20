export const getFromStorage = <T = unknown>(key: string | null, area: "sync" | "local") => {
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

      resolve(data);
    });
  });
};

export const setToStorage = <T = unknown>(key: string, value: T, area: "sync" | "local") => {
  return new Promise<void>((resolve, reject) => {
    chrome.storage[area].set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError?.message || `Failed to save ${key} in ${area} storage.`));
      } else {
        resolve();
      }
    });
  });
};