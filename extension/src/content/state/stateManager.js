export class StateManager {
  constructor() {
    this.settings = {
      sourceLanguageCode: "auto",
      targetLanguageCode: "en-US",
      autoPause: true,
    };
    this.isSelecting = false;
    this.cacheLoaded = false;
  }
}