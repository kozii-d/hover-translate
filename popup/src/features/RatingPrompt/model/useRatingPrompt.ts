import { useEffect, useState } from "react";

import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import {
  MIN_CACHED_TRANSLATIONS,
  POPUP_MIN_SAVED_WORDS,
  getReviewPageUrl,
  isPopupRatingPromptDue,
} from "@extension/common/ratingPrompt.ts";

/**
 * Whether this opening of the popup may show the rating card: null until
 * storage has answered, so the tips it replaces do not flash first. Opening
 * the popup spends nothing: the card stays from opening to opening until the
 * viewer answers it.
 */
export const useRatingPrompt = (): boolean | null => {
  const { get } = useStorage();
  const [due, setDue] = useState<boolean | null>(null);

  useEffect(() => {
    const decide = async (): Promise<boolean> => {
      if (!getReviewPageUrl(chrome.runtime.getURL(""), chrome.runtime.id)) return false;

      const sync = (await get<Record<string, unknown>>(null, "sync")) ?? {};
      if (!isPopupRatingPromptDue(sync, Date.now())) return false;

      const savedTranslations = await get<unknown>("savedTranslations", "local");
      if (Array.isArray(savedTranslations) && savedTranslations.length >= POPUP_MIN_SAVED_WORDS) return true;

      // Read only now: it can hold thousands of entries.
      const translationCache = await get<unknown>("translationCache", "local");
      return Array.isArray(translationCache) && translationCache.length >= MIN_CACHED_TRANSLATIONS;
    };

    decide()
      .then(setDue)
      .catch((error) => {
        console.error("Could not decide whether to ask for a rating", error);
        setDue(false);
      });
  }, [get]);

  return due;
};
