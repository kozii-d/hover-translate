import { StateManager } from "./state/stateManager.js";
import { StorageManager } from "./managers/storageManager.js";
import { TranslationCore } from "./core/translationCore.js";
import { SubtitleCore } from "./core/subtitleCore.js";
import { TooltipManager } from "./managers/tooltipManager.js";
import { VideoController } from "./core/videoController.js";
import { MutationObserverManager } from "./managers/mutationObserverManager.js";
import { KeyboardManager } from "./managers/keyboardManager.js";
import { TokenManager } from "./managers/tokenManager.js";

function main() {
  try {
    const state = new StateManager();
    const storageManager = new StorageManager(state);
    const tokenManager = new TokenManager(storageManager);
    const translationCore = new TranslationCore(state, tokenManager, storageManager);
    const tooltipManager = new TooltipManager(state, translationCore, tokenManager);
    const subtitleCore = new SubtitleCore(tooltipManager);
    const videoController = new VideoController(state);
    new MutationObserverManager(subtitleCore, videoController, tooltipManager);
    new KeyboardManager(state);
  } catch (error) {
    console.error(error);
  }
}

main();