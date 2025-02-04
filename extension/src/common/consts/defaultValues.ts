import { Settings, TooltipTheme } from "../types/settings.ts";

export const defaultSettings: Settings = {
  sourceLanguageCode: "auto",
  targetLanguageCode: "en",
  translator: "google",
  autoPause: true,
};

export const defaultTooltipTheme: TooltipTheme = {
  useYouTubeSettings: true,
  fontFamily: "auto",
  fontColor: "auto",
  fontSize: "auto",
  backgroundColor: "auto",
  backgroundOpacity: "auto",
  characterEdgeStyle: "auto",
  fontOpacity: "auto",
};