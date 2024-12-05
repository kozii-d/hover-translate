import { StateManager } from "./state/stateManager.js";
import { StorageManager } from "./managers/storageManager.js";
import { TranslationCore } from "./core/translationCore.js";
import { SubtitleCore } from "./core/subtitleCore.js";
import { TooltipManager } from "./managers/tooltipManager.js";
import { VideoController } from "./core/videoController.js";
import { MutationObserverManager } from "./managers/mutationObserverManager.js";
import { KeyboardManager } from "./managers/keyboardManager.js";

async function initExtension() {
  const state = new StateManager();
  const storageManager = new StorageManager(state);
  const translationCore = new TranslationCore(state);
  const tooltipManager = new TooltipManager(state, translationCore);
  const subtitleCore = new SubtitleCore(tooltipManager);
  const videoController = new VideoController(state);
  const mutationObserverManager = new MutationObserverManager(subtitleCore, videoController, tooltipManager);
  const keyboardManager = new KeyboardManager(state);

  await translationCore.loadTranslationCache();
  storageManager.initializeLanguages();
  storageManager.checkStorageChanges();
  mutationObserverManager.observeMutations();
  keyboardManager.initializeKeyboardListeners();
}

initExtension();