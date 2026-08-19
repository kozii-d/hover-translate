import { Headers as PolyfillHeaders } from "headers-polyfill";
(globalThis as unknown as { Headers: typeof PolyfillHeaders }).Headers = PolyfillHeaders;
import { TranslationCore } from "./core/translationCore.ts";
import { SubtitleCore } from "./core/subtitleCore.ts";
import { TooltipService } from "./services/tooltipService.ts";
import { VideoController } from "./core/videoController.ts";
import { MutationObserverService } from "./services/mutationObserverService.ts";
import { TranslatorFactory } from "../common/translators/TranslatorFactory.ts";
import { ProxyTranslator } from "../common/translators/proxyTranslator.ts";
import { Settings } from "../common/types/settings.ts";

let activeObserverService: MutationObserverService | null = null;
let activeTranslatorKey: string | null = null;
// Guards against two initializations overlapping while storage is being read.
let initGeneration = 0;

const main = async () => {
  const generation = ++initGeneration;

  try {
    const settings = await chrome.storage.sync.get("settings");

    const translatorKey = settings?.settings?.translator || "google";

    // A newer initialization started while this one was reading storage, so
    // this one would only install a pipeline that is already out of date.
    if (generation !== initGeneration) return;

    const selectedTranslator = TranslatorFactory.create(translatorKey);

    // Translators whose hosts reject cross-origin requests from the page have to
    // run in the background service worker.
    const translator = selectedTranslator.needsBackgroundProxy
      ? new ProxyTranslator(selectedTranslator)
      : selectedTranslator;

    const translationCore = new TranslationCore(translator);
    const tooltipService = new TooltipService(translationCore);
    const subtitleCore = new SubtitleCore(tooltipService);
    const videoController = new VideoController();

    // Release the previous pipeline first: it owns observers, intervals and a
    // history patch that would otherwise keep running for the life of the tab.
    activeObserverService?.destroy();
    activeObserverService = new MutationObserverService(subtitleCore, videoController, tooltipService);
    activeTranslatorKey = translatorKey;
  } catch (error) {
    console.error(error);
  }
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.settings?.newValue) return;

  // Every other setting is read live through `state`, so only a different
  // translator actually requires rebuilding the pipeline.
  const translatorKey = (changes.settings.newValue as Settings).translator || "google";
  if (translatorKey === activeTranslatorKey) return;

  main();
});

main();
