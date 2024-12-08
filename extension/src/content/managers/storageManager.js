export class StorageManager {
  constructor(state) {
    this.state = state;
    chrome.storage.local.clear();
  }

  initializeLanguages() {
    chrome.storage.sync.get(["settings"], (result) => {
      const { settings } = result;

      if (settings) {
        this.state.settings = settings;
      }
    });
  }

  checkStorageChanges() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.settings) {
          this.state.settings = changes.settings.newValue;
        }
      }
    });
  }
}