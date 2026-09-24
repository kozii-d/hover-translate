import {
  CAPTION_WINDOW_CONTAINER,
  CAPTION_SEGMENT,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS,
} from "../consts/consts";
import { SubtitleCore } from "../core/subtitleCore";
import { VideoController } from "../core/videoController";
import { TooltipService } from "./tooltipService.ts";
import { CoveredCaptionPointerService } from "./coveredCaptionPointerService.ts";
import { debugLog } from "../utils/debugLog.ts";

const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  CHECK_INTERVAL: 30000,
  URL_CHECK_INTERVAL: 1000,
} as const;

const LOG_MESSAGES = {
  OBSERVING_STARTED: "[MutationObserverService] Observing started",
  NO_CONTAINER: "[MutationObserverService] No container, retrying...",
  ALL_RETRIES_EXHAUSTED:
    "[MutationObserverService] No player on this page, giving up until something changes",
  TAB_VISIBLE: "[MutationObserverService] Tab is visible, reinit observer",
  PAGE_RESTORED:
    "[MutationObserverService] Page restored from cache, reinit observer",
  URL_CHANGED: "[MutationObserverService] URL changed, reinit observer",
  CONTAINER_LOST:
    "[MutationObserverService] Observed container is gone, reinit observer",
  CAPTIONS_MISSED:
    "[MutationObserverService] Captions on screen were not split, reinit observer",
  HISTORY_METHODS_ERROR:
    "[MutationObserverService] Failed to override history methods:",
} as const;

export class MutationObserverService {
  private observer: MutationObserver;
  private urlObserver?: MutationObserver;
  // Gets the pointer to caption words that a player layer covers (the embedded player).
  private coveredCaptionPointerService = new CoveredCaptionPointerService();

  private observedContainer: Element | null = null;
  private currentHref = document.location.href;
  private destroyed = false;

  private retryTimeoutId?: ReturnType<typeof setTimeout>;
  private observerCheckIntervalId?: ReturnType<typeof setInterval>;
  private urlCheckIntervalId?: ReturnType<typeof setInterval>;

  private originalPushState?: typeof history.pushState;
  private originalReplaceState?: typeof history.replaceState;
  private patchedPushState?: typeof history.pushState;
  private patchedReplaceState?: typeof history.replaceState;

  constructor(
    private readonly subtitleCore: SubtitleCore,
    private readonly videoController: VideoController,
    private readonly tooltipService: TooltipService,
  ) {
    this.observer = new MutationObserver(this.handleMutations);

    this.startObserving();

    this.initVisibilityListener();

    this.initUrlObserver();
  }

  /**
   * Releases everything this instance attached to the page: observers, timers,
   * document/window listeners, the history patch and the caption handlers.
   *
   * Without it every rebuild of the pipeline (which happens whenever the
   * settings change) left the previous instance running, so observers, intervals
   * and history wrappers piled up for the lifetime of the tab.
   */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.stopObserving();
    this.urlObserver?.disconnect();
    this.urlObserver = undefined;

    this.clearRetryTimeout();
    clearInterval(this.observerCheckIntervalId);
    clearInterval(this.urlCheckIntervalId);

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("pageshow", this.handlePageShow);
    window.removeEventListener("popstate", this.handleUrlChange);
    window.removeEventListener("hashchange", this.handleUrlChange);

    this.restoreHistoryMethods();

    this.coveredCaptionPointerService.destroy();

    document.querySelectorAll(`.${CAPTION_WINDOW}`).forEach((captionWindow) => {
      this.detachCaptionWindowListeners(captionWindow);
    });

    this.videoController.destroy();

    this.tooltipService.deleteActiveTooltip();
    this.tooltipService.clearSelectedWords();
  }

  /**
   * Main callback called when DOM changes.
   */
  private handleMutations = (mutations: MutationRecord[]): void => {
    let wordsChanged = false;

    mutations.forEach((mutation) => {
      // 1. Handle all added nodes.
      mutation.addedNodes.forEach((node) => {
        wordsChanged = this.handleAddedNode(node) || wordsChanged;
      });

      // 2. Handle all removed nodes.
      mutation.removedNodes.forEach((node) => {
        wordsChanged = this.handleRemovedNode(node) || wordsChanged;
      });
    });

    if (!wordsChanged) return;

    // 3. Reindex first — the selection is expressed in those indexes, so it can
    // only be re-resolved once every word carries its current one. Re-resolving
    // instead of clearing is what keeps a selection alive while auto-generated
    // captions grow under the cursor.
    this.subtitleCore.setWordsIndexes();
    this.tooltipService.refreshSelectedWords();
  };

  private attachCaptionWindowListeners(captionWindow: Element): void {
    // Re-adding the same listener is a no-op, so this is safe to repeat.
    captionWindow.addEventListener(
      "pointerenter",
      this.videoController.handleVideoPause,
    );
    captionWindow.addEventListener(
      "pointerleave",
      this.videoController.handleVideoPlay,
    );
    captionWindow.addEventListener(
      "pointerleave",
      this.subtitleCore.handlePointerLeaveOnCaptionWindow,
    );
  }

  private detachCaptionWindowListeners(captionWindow: Element): void {
    captionWindow.removeEventListener(
      "pointerenter",
      this.videoController.handleVideoPause,
    );
    captionWindow.removeEventListener(
      "pointerleave",
      this.videoController.handleVideoPlay,
    );
    captionWindow.removeEventListener(
      "pointerleave",
      this.subtitleCore.handlePointerLeaveOnCaptionWindow,
    );
  }

  /**
   * Handle added node:
   * - split captions into words,
   * - update caption window size,
   * - add events to the caption window (mouseenter/mouseleave).
   */
  private handleAddedNode(node: Node): boolean {
    let wordsChanged = false;

    // If it's an Element, check for caption segments inside
    if (node instanceof Element) {
      const segments = node.querySelectorAll(`.${CAPTION_SEGMENT}`);
      segments.forEach((segment) => {
        if (segment instanceof HTMLElement) {
          wordsChanged =
            this.subtitleCore.splitCaptionIntoSpans(segment) || wordsChanged;
        }
      });
      this.subtitleCore.updateCaptionWindowSize();

      // If it's a caption window, add events for pause/play
      if (node.classList.contains(CAPTION_WINDOW)) {
        this.attachCaptionWindowListeners(node);
      }
    }

    // For auto-generated captions (TEXT_NODE inside CaptionSegment)
    if (node.nodeType === Node.TEXT_NODE) {
      const captionSegment = node.parentElement;
      if (
        captionSegment &&
        captionSegment.classList.contains(CAPTION_SEGMENT)
      ) {
        wordsChanged =
          this.subtitleCore.splitCaptionIntoSpans(captionSegment) ||
          wordsChanged;
      }
    }

    return wordsChanged;
  }

  /**
   * Handle removed node:
   * - remove events,
   * - delete tooltips and clear selected words,
   * - report whether words left the captions, so the selection gets re-resolved.
   */
  private handleRemovedNode(node: Node): boolean {
    if (!(node instanceof Element)) return false;

    // If it's a caption window, remove events and delete tooltips
    if (node.classList.contains(CAPTION_WINDOW)) {
      this.detachCaptionWindowListeners(node);
      this.tooltipService.deleteActiveTooltip();
      this.tooltipService.clearSelectedWords();
      return false;
    }

    // A single caption line can be dropped on its own — auto-generated captions
    // scroll line by line — and the selection has to be re-resolved without it.
    return (
      node.classList.contains(TOOLTIP_WORD_CLASS) ||
      node.querySelector(`.${TOOLTIP_WORD_CLASS}`) !== null
    );
  }

  /**
   * Captions already on screen carry handlers bound to whichever instance split
   * them, so they are re-processed here. That both picks up captions that were
   * already visible before observing started and hands them over to this
   * instance when the pipeline is rebuilt.
   */
  private processExistingCaptions(): void {
    document.querySelectorAll(`.${CAPTION_SEGMENT}`).forEach((segment) => {
      if (segment instanceof HTMLElement) {
        this.subtitleCore.splitCaptionIntoSpans(segment);
      }
    });

    document.querySelectorAll(`.${CAPTION_WINDOW}`).forEach((captionWindow) => {
      this.attachCaptionWindowListeners(captionWindow);
    });

    this.subtitleCore.setWordsIndexes();
    this.subtitleCore.updateCaptionWindowSize();
  }

  /**
   * Starts observing the caption container.
   * Uses exponential backoff for retries with a maximum delay of 10 seconds.
   * If all retries are exhausted, starts a new retry cycle.
   * @param retryCount - The number of retries left.
   */
  private startObserving(retryCount: number = RETRY_CONFIG.MAX_RETRIES): void {
    if (this.destroyed) return;

    this.stopObserving();
    // Drop the retry chain already in flight, if any: every re-arm (tab focus,
    // URL change, watchdog) used to start another chain that ran forever.
    this.clearRetryTimeout();

    const captionContainer = this.findCaptionContainer();

    if (captionContainer) {
      this.observer.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
      this.observedContainer = captionContainer;
      this.processExistingCaptions();
      debugLog(
        LOG_MESSAGES.OBSERVING_STARTED,
        `containers=${document.querySelectorAll(`.${CAPTION_WINDOW_CONTAINER}`).length}`,
        `segments=${document.querySelectorAll(`.${CAPTION_SEGMENT}`).length}`,
        `segmentsInsideObserved=${captionContainer.querySelectorAll(`.${CAPTION_SEGMENT}`).length}`,
        `words=${document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`).length}`,
        document.location.pathname,
      );
      return;
    }

    debugLog(
      LOG_MESSAGES.NO_CONTAINER,
      `retriesLeft=${retryCount}`,
      document.location.pathname,
    );

    // Out of attempts: this page simply has no player — the home feed, a channel,
    // Shorts, an ad frame. Starting the whole chain again from here is what kept
    // every such tab busy for as long as it stayed open. The periodic check below
    // and the navigation signals will look again when there is a reason to.
    if (retryCount <= 0) {
      debugLog(LOG_MESSAGES.ALL_RETRIES_EXHAUSTED);
      return;
    }

    // Calculate delay using exponential backoff
    const delay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY *
        Math.pow(2, RETRY_CONFIG.MAX_RETRIES - retryCount),
      RETRY_CONFIG.MAX_DELAY,
    );

    this.retryTimeoutId = setTimeout(
      () => this.startObserving(retryCount - 1),
      delay,
    );
  }

  /**
   * The caption container worth observing.
   *
   * YouTube keeps several players alive at once — the watch player, the
   * miniplayer, the inline preview a hovered thumbnail starts on the feed — and
   * the one a previous page left behind stays in the document, *earlier* than
   * the live one. Taking the first match therefore attached the observer to a
   * dead container: captions rendered normally, nothing was ever split into
   * words, and the container stayed connected so nothing ever noticed.
   */
  private findCaptionContainer(): Element | null {
    const containers = Array.from(
      document.querySelectorAll(`.${CAPTION_WINDOW_CONTAINER}`),
    );

    if (containers.length <= 1) {
      return containers[0] ?? null;
    }

    // Captions on screen that nobody has split are exactly the ones being
    // missed, which makes their container the one to watch.
    const containerWithMissedCaptions = containers.find(
      (container) => this.countUnprocessedCaptions(container) > 0,
    );
    if (containerWithMissedCaptions) return containerWithMissedCaptions;

    // Otherwise prefer a player the viewer can actually see: a leftover
    // container is still in the document but has no box.
    const visibleContainer = containers.find((container) => {
      const { width, height } = container.getBoundingClientRect();
      return width > 0 && height > 0;
    });

    return visibleContainer ?? containers[0];
  }

  /**
   * Caption lines that are on screen but were never split into words.
   *
   * A non-zero count while an observer is attached means the captions are being
   * rendered somewhere the observer is not watching.
   */
  private countUnprocessedCaptions(root: ParentNode = document): number {
    return Array.from(root.querySelectorAll(`.${CAPTION_SEGMENT}`)).filter(
      (segment) =>
        segment.textContent?.trim() &&
        !segment.querySelector(`.${TOOLTIP_WORD_CLASS}`),
    ).length;
  }

  private stopObserving(): void {
    this.observer.disconnect();
    this.observedContainer = null;
  }

  private clearRetryTimeout(): void {
    clearTimeout(this.retryTimeoutId);
    this.retryTimeoutId = undefined;
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") return;

    debugLog(LOG_MESSAGES.TAB_VISIBLE);
    this.startObserving();
  };

  private handlePageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted) return;

    debugLog(LOG_MESSAGES.PAGE_RESTORED);
    this.startObserving();
  };

  private initVisibilityListener(): void {
    // Handling visibility change
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Handling page restoration from cache
    window.addEventListener("pageshow", this.handlePageShow);

    this.observerCheckIntervalId = setInterval(() => {
      if (this.observedContainer) {
        // YouTube can replace the whole player, which leaves the observer
        // attached to a container no longer in the document. It is worth the
        // full retry chain: the replacement is on its way in.
        if (!this.observedContainer.isConnected) {
          debugLog(LOG_MESSAGES.CONTAINER_LOST);
          this.startObserving();
        }
        return;
      }

      // A retry chain is already looking — it was armed by a navigation and is
      // walking its backoff right now. Looking again from here would cancel that
      // chain (`startObserving` drops the pending timeout) and then give up,
      // which left the next video unhandled until the following tick.
      if (this.retryTimeoutId !== undefined) return;

      // Nothing was ever found here, so nothing was lost. Take a single look in
      // case a player has appeared since — one attempt, not another chain.
      this.startObserving(0);
    }, RETRY_CONFIG.CHECK_INTERVAL);
  }

  private handleUrlChange = (): void => {
    const newHref = document.location.href;
    if (this.currentHref === newHref) return;

    this.currentHref = newHref;
    this.startObserving();
    debugLog(LOG_MESSAGES.URL_CHANGED);
  };

  /**
   * Captions on screen that were never split mean the observer is watching the
   * wrong container — or none at all — whatever the container's own state says.
   * It is the one symptom that is impossible to argue with, so it is checked
   * often and cheaply: a `querySelectorAll` that returns nothing on every page
   * without captions.
   */
  private handleMissedCaptions = (): void => {
    if (this.destroyed) return;

    // A retry chain is already looking; leave it to finish.
    if (this.retryTimeoutId !== undefined) return;

    if (this.countUnprocessedCaptions() === 0) return;

    debugLog(LOG_MESSAGES.CAPTIONS_MISSED);
    this.startObserving();
  };

  private handlePeriodicCheck = (): void => {
    this.handleUrlChange();
    this.handleMissedCaptions();
  };

  /**
   * Check for URL changes.
   */
  private initUrlObserver(): void {
    // A «hacky» way to watch for URL changes by observing <title> changes.
    const titleElement = document.querySelector("title");
    if (titleElement) {
      this.urlObserver = new MutationObserver(this.handleUrlChange);
      this.urlObserver.observe(titleElement, { childList: true });
    }

    // Additional handlers
    window.addEventListener("popstate", this.handleUrlChange);
    window.addEventListener("hashchange", this.handleUrlChange);

    const handleUrlChange = this.handleUrlChange;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    try {
      const patchedPushState: typeof history.pushState = function (
        this: History,
        ...args
      ) {
        originalPushState.apply(this, args);

        handleUrlChange();
      };

      const patchedReplaceState: typeof history.replaceState = function (
        this: History,
        ...args
      ) {
        originalReplaceState.apply(this, args);

        handleUrlChange();
      };

      history.pushState = patchedPushState;
      history.replaceState = patchedReplaceState;

      this.originalPushState = originalPushState;
      this.originalReplaceState = originalReplaceState;
      this.patchedPushState = patchedPushState;
      this.patchedReplaceState = patchedReplaceState;
    } catch (error) {
      console.error(LOG_MESSAGES.HISTORY_METHODS_ERROR, error);
    }

    // Periodic check
    this.urlCheckIntervalId = setInterval(
      this.handlePeriodicCheck,
      RETRY_CONFIG.URL_CHECK_INTERVAL,
    );
  }

  private restoreHistoryMethods(): void {
    // Only unwrap what is still ours — another script may have patched on top,
    // and replacing that would break it.
    if (this.originalPushState && history.pushState === this.patchedPushState) {
      history.pushState = this.originalPushState;
    }

    if (
      this.originalReplaceState &&
      history.replaceState === this.patchedReplaceState
    ) {
      history.replaceState = this.originalReplaceState;
    }
  }
}
