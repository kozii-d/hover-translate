import { Headers as PolyfillHeaders } from "headers-polyfill";
(globalThis as unknown as { Headers: typeof PolyfillHeaders }).Headers = PolyfillHeaders;
import { TranslationCore } from "./core/translationCore.ts";
import { SubtitleCore } from "./core/subtitleCore.ts";
import { TooltipService } from "./services/tooltipService.ts";
import { VideoController } from "./core/videoController.ts";
import { MutationObserverService } from "./services/mutationObserverService.ts";
import { TranslatorFactory } from "../common/translators/TranslatorFactory.ts";
import { ProxyTranslator } from "../common/translators/proxyTranslator.ts";
import { ReplacementTranslator } from "../common/translators/replacementTranslator.ts";
import { BING_HOST, BING_ORIGIN } from "../common/translators/bing/bing.ts";
import { sendMessageToBackground } from "../common/services/messagingService.ts";
import { Settings } from "../common/types/settings.ts";
import { state } from "./state/stateManager.ts";

let activeObserverService: MutationObserverService | null = null;
let activeTranslationCore: TranslationCore | null = null;
let activeTranslatorKey: string | null = null;
// Guards against two initializations overlapping while storage is being read.
let initGeneration = 0;

/**
 * Paths that carry a player: the watch page, the embeddable players (`/embed/`
 * and its `/e/` and `/v/` ancestors), Shorts, live streams and clips.
 */
const PLAYER_PATH = /^\/(watch|embed|e|v|shorts|live|clip)(\/|$)/;

/**
 * Whether this frame is worth building the pipeline in.
 *
 * The content script is declared with `all_frames: true` because a YouTube
 * player can be embedded in a frame on any site, and it is injected into every
 * frame whose URL is on youtube.com — including the service frames YouTube
 * itself opens on a watch page (`/RotateCookiesPage`, `/live_chat`, the pixel
 * frames). Each of those used to get the whole pipeline: two intervals, two
 * MutationObservers, a patched `history` and the caption retry chain, all
 * waiting for a player that cannot possibly appear there.
 *
 * The top frame is never turned down: YouTube is a single-page app, so a tab
 * that opened on the feed becomes a watch page without loading a new document,
 * and the content script is only injected on document load.
 */
const canHostPlayer = (): boolean =>
  window.top === window.self || PLAYER_PATH.test(document.location.pathname);

/**
 * Whether the extension may reach `origin`, asked of the background: a content
 * script has no permissions API. When it cannot tell, the answer is yes, and
 * the translator's own requests say what is wrong.
 */
const hasPermission = (origin: string): Promise<boolean> =>
  sendMessageToBackground<{ granted: boolean }>({ action: "hasPermissions", value: { origins: [origin] } })
    .then(({ granted }) => granted)
    .catch(() => true);

const main = async () => {
  const generation = ++initGeneration;

  try {
    const settings = await chrome.storage.sync.get("settings");

    const translatorKey = settings?.settings?.translator || "google";

    // Bing's host is an optional permission, and Bing can be selected without
    // it: Chrome dropped it in 1.1.14, Firefox never granted it. Until the
    // viewer allows it — picking Bing in the settings asks, and saving the
    // choice rebuilds this pipeline — Google translates in its place, with the
    // languages carried over, as in 1.1.14. Allowed anywhere else, it takes
    // effect on the next page load.
    const bingWithoutAccess = translatorKey === "bing" && !(await hasPermission(BING_ORIGIN));

    // A newer initialization started while this one was reading storage, so
    // this one would only install a pipeline that is already out of date.
    if (generation !== initGeneration) return;

    const requestedTranslator = TranslatorFactory.create(translatorKey);
    const selectedTranslator = bingWithoutAccess
      ? new ReplacementTranslator(TranslatorFactory.create("google"))
      : requestedTranslator;

    // Translators whose hosts reject cross-origin requests from the page have to
    // run in the background service worker.
    const translator = selectedTranslator.needsBackgroundProxy
      ? new ProxyTranslator(selectedTranslator)
      : selectedTranslator;

    const translationCore = new TranslationCore(translator);
    const tooltipService = new TooltipService(translationCore);
    const subtitleCore = new SubtitleCore(tooltipService);
    const videoController = new VideoController();

    if (bingWithoutAccess) {
      tooltipService.showWithFirstTranslation(
        "bingPermissionFallback",
        chrome.i18n.getMessage("noticePermissionFallback", [requestedTranslator.name, BING_HOST, selectedTranslator.name]),
      );
    }

    // Release the previous pipeline first: it owns observers, intervals, storage
    // listeners and a history patch that would otherwise keep running for the
    // life of the tab.
    activeObserverService?.destroy();
    activeTranslationCore?.destroy();

    activeObserverService = new MutationObserverService(subtitleCore, videoController, tooltipService);
    activeTranslationCore = translationCore;
    activeTranslatorKey = translatorKey;
  } catch (error) {
    console.error(error);
  }
};

if (canHostPlayer()) {
  // Reading the settings and subscribing to their changes is the state
  // singleton's own work, kept out of its constructor so that a frame stopping
  // here touches neither storage nor the page.
  state.init();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.settings?.newValue) return;

    // Every other setting is read live through `state`, so only a different
    // translator actually requires rebuilding the pipeline.
    const translatorKey = (changes.settings.newValue as Settings).translator || "google";
    if (translatorKey === activeTranslatorKey) return;

    main();
  });

  main();
}
