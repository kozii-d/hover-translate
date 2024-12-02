import { initializeLanguages, checkStorageChanges } from "./content/storage.js";
import { observeMutations } from "./content/mutationObserver.js";
import { loadTranslationCache } from "./content/translation.js";

async function initExtension() {
  await loadTranslationCache();
  initializeLanguages();
  checkStorageChanges();
  observeMutations();
}

initExtension();