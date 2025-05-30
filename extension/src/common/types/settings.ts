export interface Settings {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: "google" | "bing";
  useDictionary: boolean;
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