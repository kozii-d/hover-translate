import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "@extension/common/types/settings.ts";
import { Language } from "@extension/common/types/languages.ts";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { requestAvailableLanguages } from "@/shared/lib/helpers/translatorRequests.ts";

export type TargetLanguageState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; settings: Settings; languages: Language[] };

/**
 * The stored settings and the languages their translator translates into,
 * followed as they change elsewhere (the popup, after "Open settings"), as the
 * content script follows them. No settings stored counts as a failure, like
 * one that cannot be read: the page never shows defaults the viewer would take
 * for their settings.
 */
export const useTargetLanguage = () => {
  const [state, setState] = useState<TargetLanguageState>({ status: "loading" });
  const { get, set } = useStorage();
  // Only the latest read lands: DeepL's list can take longer than a change after it.
  const lastRead = useRef(0);

  const readSettings = useCallback(async () => {
    const settings = await get<Settings>("settings", "sync");
    if (!settings) throw new Error("No settings are stored");
    return settings;
  }, [get]);

  /** Reads the settings and their translator's languages; `loading` while it does, on a first read. */
  const read = useCallback(async (showLoading: boolean) => {
    const readId = ++lastRead.current;
    if (showLoading) setState({ status: "loading" });
    try {
      const settings = await readSettings();
      const { targetLanguages } = await requestAvailableLanguages(settings.translator);
      if (!targetLanguages?.length) throw new Error("The translator returned no languages");
      if (readId === lastRead.current) setState({ status: "ready", settings, languages: targetLanguages });
    } catch (error) {
      console.error("Could not load the language to translate into", error);
      if (readId === lastRead.current) setState({ status: "failed" });
    }
  }, [readSettings]);

  const load = useCallback(() => read(true), [read]);

  /**
   * Saves `targetLanguageCode` into the settings as they are stored now, every
   * other field as it is. When that fails nobody knows what is stored, so the
   * page shows its error screen.
   */
  const save = useCallback(async (targetLanguageCode: string) => {
    try {
      const settings = { ...await readSettings(), targetLanguageCode };
      await set<Settings>("settings", settings, "sync");
      setState((current) => (current.status === "ready" ? { ...current, settings } : current));
    } catch (error) {
      console.error("Could not save the language to translate into", error);
      setState({ status: "failed" });
    }
  }, [readSettings, set]);

  useEffect(() => {
    load();

    const handleChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "sync" && "settings" in changes) read(false);
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, [load, read]);

  return { state, load, save };
};
