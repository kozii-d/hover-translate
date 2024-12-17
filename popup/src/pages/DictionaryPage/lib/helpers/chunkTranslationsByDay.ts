import { Translation } from "../../model/types/schema.ts";
import dayjs from "dayjs";

export const chunkTranslationsByDay = (translations: Translation[]): Translation[][] => {
  const sortedTranslations = translations.sort((a, b) => b.timestamp - a.timestamp);
  const groupByDay = (items: Translation[]): Map<string, Translation[]> => {
    return items.reduce((groups, item) => {
      const date = dayjs(item.timestamp).format("YYYY-MM-DD");

      if (!groups.get(date)) {
        groups.set(date, []);
      }

      groups.get(date)!.push(item);

      return groups;

    }, new Map<string, Translation[]>());
  };

  return Array.from(groupByDay(sortedTranslations).values());
};