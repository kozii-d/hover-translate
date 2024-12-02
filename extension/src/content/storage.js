import { state } from "./variables.js";

export function initializeLanguages() {
  chrome.storage.sync.get(["settings"], (result) => {
    const { settings } = result;

    if (settings) {
      state.settings = settings;
    }
  });
}

export function checkStorageChanges() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.settings) {
        state.settings = changes.settings.newValue;
      }
    }
  });
}