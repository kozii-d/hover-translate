import { getFromStorage } from "@/shared/lib/helpers/storage.ts";
import { SavedTranslation, TranslationToExport } from "../../model/types/types.ts";
import dayjs from "dayjs";

const getDataToExport = async (): Promise<TranslationToExport[]> => {
  const savedTranslations = await getFromStorage<SavedTranslation[]>("savedTranslations", "local");

  if (!savedTranslations) {
    return [];
  }

  return savedTranslations.map((translation => {
    return {
      "Date": dayjs(translation.timestamp).format("DD/MM/YYYY HH:mm:ss"),
      "Translator": translation.translatorName,
      "Language": `${translation.sourceLanguageCode}-${translation.targetLanguageCode}`,
      "Original": translation.originalText,
      "Translation": translation.translatedText,
      "Transliteration": translation.transliteration || "",
      "Transcription": translation.transcription || "",
      "Dictionary": translation.dictionary || "",
    };
  }));
};

export const getJSONToExport = async (): Promise<string> => {
  const data = await getDataToExport();
  return JSON.stringify(data, null, 2);
};

export const getCSVToExport = async (): Promise<string> => {
  const data = await getDataToExport();

  if (data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]) as Array<keyof TranslationToExport>;

  const escapeValue = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = value.toString();
    if (/[,"\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, "\"\"")}"`;
    }
    return stringValue;
  };

  const csv = [headers.join(",")]; // Заголовок
  data.forEach((item) => {
    const row = headers.map((header) => escapeValue(item[header]));
    csv.push(row.join(","));
  });

  return csv.join("\n");
};