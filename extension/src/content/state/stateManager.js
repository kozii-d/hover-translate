export class StateManager {
  constructor() {
    this.settings = {
      sourceLanguageCode: "auto",
      targetLanguageCode: "en-US",
      autoPause: true,
    };
    this.customize = {
      useYouTubeSettings: true,
      fontFamily: "auto",
      fontColor: "auto",
      fontSize: "auto",
      backgroundColor: "auto",
      backgroundOpacity: "auto",
      characterEdgeStyle: "auto",
      fontOpacity: "auto",
    };
    this.isSelecting = false;
    this.cacheLoaded = false;
  }
}