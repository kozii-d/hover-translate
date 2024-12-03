import { initializeLanguages, checkStorageChanges } from "./content/storage.js";
import { observeMutations } from "./content/mutationObserver.js";
import { loadTranslationCache } from "./content/translation.js";
import { initializeKeyboardListeners } from "./content/keyboard.js";

async function initExtension() {
  await loadTranslationCache();
  initializeLanguages();
  checkStorageChanges();
  observeMutations();
  initializeKeyboardListeners();
}

initExtension();