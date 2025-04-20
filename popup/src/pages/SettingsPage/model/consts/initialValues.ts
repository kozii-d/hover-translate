import { SettingsFormValues } from "../types/schema.ts";

export const initialFormValues: SettingsFormValues = {
  sourceLanguageCode: "auto",
  targetLanguageCode: "en",
  autoPause: true,
  translator: "google",
  useDictionary: true,
  alwaysMultipleSelection: false,
  showNotifications: true,
};