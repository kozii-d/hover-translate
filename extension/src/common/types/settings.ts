export interface Settings {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
  translator: "google" | "bing";
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