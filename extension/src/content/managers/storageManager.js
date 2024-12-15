export class StorageManager {
  constructor(state) {
    this.state = state;
  }

  initializeSettings() {
    chrome.storage.sync.get(["settings", "customize"], (result) => {
      const { settings, customize } = result;

      if (settings) {
        this.state.settings = settings;
      }

      if (customize) {
        this.state.customize = customize;
      }
    });
  }

  checkStorageChanges() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.settings) {
          this.state.settings = changes.settings.newValue;
        }
        if (changes.customize) {
          this.state.customize = changes.customize.newValue;
        }
      }
    });
  }
}