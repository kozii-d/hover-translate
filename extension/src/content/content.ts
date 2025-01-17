import { TranslationCore } from "./core/translationCore.ts";
import { SubtitleCore } from "./core/subtitleCore.ts";
import { TooltipService } from "./services/tooltipService.ts";
import { VideoController } from "./core/videoController.ts";
import { MutationObserverService } from "./services/mutationObserverService.ts";
import { GoogleTranslator } from "../common/translators/google/google.ts";

function main() {
  try {
    const translationCore = new TranslationCore(new GoogleTranslator());
    const tooltipService = new TooltipService(translationCore);
    const subtitleCore = new SubtitleCore(tooltipService);
    const videoController = new VideoController();
    new MutationObserverService(subtitleCore, videoController, tooltipService);
  } catch (error) {
    console.error(error);
  }
}

main();