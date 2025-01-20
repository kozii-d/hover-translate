import { getFromStorage, setToStorage } from "@/shared/lib/helpers/storage.ts";

export const useStorage = () => {
  return { get: getFromStorage, set: setToStorage };
};