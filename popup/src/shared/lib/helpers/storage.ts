import { StorageService } from "@extension/common/services/storageService.ts";

/**
 * The popup's access to `chrome.storage`.
 *
 * The implementation lives in the extension package: the popup and the content
 * script read and write the very same keys, and for a long time each carried its
 * own copy of the same promise wrapper. They drifted — `setMany()`, which exists
 * so that a value and its version number cannot land separately, was only ever
 * added to one of them.
 */
const storageService = new StorageService();

export const getFromStorage = <T = unknown>(
  key: string | null,
  area: "sync" | "local",
) => storageService.get<T>(key, area);

export const setToStorage = <T = unknown>(
  key: string,
  value: T,
  area: "sync" | "local",
) => storageService.set<T>(key, value, area);
