import { TranslationCore } from "./core/translationCore.ts";
import { SubtitleCore } from "./core/subtitleCore.ts";
import { TooltipService } from "./services/tooltipService.ts";
import { VideoController } from "./core/videoController.ts";
import { MutationObserverService } from "./services/mutationObserverService.ts";
import { KeyboardService } from "./services/keyboardService.ts";

function main() {
  try {
    const translationCore = new TranslationCore();
    const tooltipService = new TooltipService(translationCore);
    const subtitleCore = new SubtitleCore(tooltipService);
    const videoController = new VideoController();
    new MutationObserverService(subtitleCore, videoController, tooltipService);
    new KeyboardService();
  } catch (error) {
    console.error(error);
  }
}

main();