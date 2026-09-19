import { MenuItemType } from "@/shared/types/types.ts";
import { Translator } from "../types/schema.ts";

export const FALLBACK_TRANSLATOR: Translator = "google";

export const TRANSLATORS_OPTIONS: MenuItemType<Translator>[] = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
  { value: "deepl", label: "DeepL" },
];

export const getTranslatorLabel = (translator: string) => {
  return TRANSLATORS_OPTIONS.find((option) => option.value === translator)?.label || "Unknown";
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
};
