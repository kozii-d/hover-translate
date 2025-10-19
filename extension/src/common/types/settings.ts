export type Translator = "google" | "bing";
export type LeftClickAction = "nothing" | "copy-original" | "copy-translation" | "save-to-dictionary";

export interface Settings {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: Translator;
  leftClickAction: LeftClickAction;
  alwaysMultipleSelection: boolean;
  showNotifications: boolean;
}

export interface TooltipTheme {
  useYouTubeSettings: boolean;
  fontFamily: string;
  fontColor: string;
  fontSize: string;
  backgroundColor: string;
  backgroundOpacity: string;
  characterEdgeStyle: string;
  fontOpacity: string;
}