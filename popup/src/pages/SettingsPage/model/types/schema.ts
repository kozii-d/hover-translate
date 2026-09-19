export type Translator = "google" | "bing" | "deepl";
export type LeftClickAction = "nothing" | "copy-original" | "copy-translation" | "save-to-dictionary";

export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: Translator;
  leftClickAction: LeftClickAction;
  alwaysMultipleSelection: boolean;
  showNotifications: boolean;
}

export interface Language {
  code: string;
  name: string;
}

export interface AvailableLanguages {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}
/**
 * The API key form, open for a translator that needs one: because the viewer
 * picked it without a key, asked to change the key, or because the stored key
 * stopped working.
 */
export interface ApiKeyPrompt {
  translator: Translator;
  /** Why the form was opened, when it was not the viewer's own choice. */
  error?: string | null;
  initialApiKey?: string;
  /**
   * The notification that announced the fallback. Closed as soon as the viewer
   * acts on the form, or it would hold back every notification queued behind
   * it — "key removed" showed up ten seconds late.
   */
  noticeKey?: string;
}
