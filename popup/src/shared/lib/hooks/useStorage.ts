import { useCallback } from "react";

export const useStorage = () => {
  const get = useCallback(<T = unknown>(key: string) => {
    return new Promise<T | null>((resolve, reject) => {
      chrome.storage.sync.get(key, (result) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message || "Failed to get data from storage."));
        }
        const data = result[key];

        if (!data) {
          return resolve(null);
        }

        resolve(data);
      });
    });
  }, []);

  const set = useCallback(<T = unknown>(key: string, value: T) => {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError?.message || "Failed to save data in storage."));
        } else {
          resolve();
        }
      });
    });
  }, []);
  
  return { get, set };
};