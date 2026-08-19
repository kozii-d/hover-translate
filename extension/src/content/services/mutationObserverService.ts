import {
  CAPTION_WINDOW_CONTAINER,
  CAPTION_SEGMENT,
  CAPTION_WINDOW,
  TOOLTIP_WORD_CLASS,
} from "../consts/consts";
import { SubtitleCore } from "../core/subtitleCore";
import { VideoController } from "../core/videoController";
import { TooltipService } from "./tooltipService.ts";

const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  CHECK_INTERVAL: 30000,
  URL_CHECK_INTERVAL: 1000
} as const;

const LOG_MESSAGES = {
  OBSERVING_STARTED: "[MutationObserverService] Observing started",
  NO_CONTAINER: "[MutationObserverService] No container, retrying...",
  ALL_RETRIES_EXHAUSTED: "[MutationObserverService] All retries exhausted, starting new cycle",
  TAB_VISIBLE: "[MutationObserverService] Tab is visible, reinit observer",
  PAGE_RESTORED: "[MutationObserverService] Page restored from cache, reinit observer",
  URL_CHANGED: "[MutationObserverService] URL changed, reinit observer",
  CONTAINER_LOST: "[MutationObserverService] Observed container is gone, reinit observer",
  HISTORY_METHODS_ERROR: "[MutationObserverService] Failed to override history methods:"
} as const;

export class MutationObserverService {
  private observer: MutationObserver;
  private urlObserver?: MutationObserver;

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
    private readonly tooltipService: TooltipService
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

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pageshow", this.handlePageShow);
    window.removeEventListener("popstate", this.handleUrlChange);
    window.removeEventListener("hashchange", this.handleUrlChange);

    this.restoreHistoryMethods();

    document.querySelectorAll(`.${CAPTION_WINDOW}`).forEach((captionWindow) => {
      this.detachCaptionWindowListeners(captionWindow);
    });

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
    captionWindow.addEventListener("pointerenter", this.videoController.handleVideoPause);
    captionWindow.addEventListener("pointerleave", this.videoController.handleVideoPlay);
    captionWindow.addEventListener("pointerleave", this.subtitleCore.handlePointerLeaveOnCaptionWindow);
  }

  private detachCaptionWindowListeners(captionWindow: Element): void {
    captionWindow.removeEventListener("pointerenter", this.videoController.handleVideoPause);
    captionWindow.removeEventListener("pointerleave", this.videoController.handleVideoPlay);
    captionWindow.removeEventListener("pointerleave", this.subtitleCore.handlePointerLeaveOnCaptionWindow);
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
          wordsChanged = this.subtitleCore.splitCaptionIntoSpans(segment) || wordsChanged;
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
      if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
        wordsChanged = this.subtitleCore.splitCaptionIntoSpans(captionSegment) || wordsChanged;
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
    return node.classList.contains(TOOLTIP_WORD_CLASS) ||
      node.querySelector(`.${TOOLTIP_WORD_CLASS}`) !== null;
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

    const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
    if (captionContainer) {
      this.observer.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
      this.observedContainer = captionContainer;
      this.processExistingCaptions();
      // eslint-disable-next-line no-console
      console.log(LOG_MESSAGES.OBSERVING_STARTED);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(LOG_MESSAGES.NO_CONTAINER);

    // Calculate delay using exponential backoff
    const delay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY * Math.pow(2, RETRY_CONFIG.MAX_RETRIES - retryCount),
      RETRY_CONFIG.MAX_DELAY
    );

    if (retryCount > 0) {
      this.retryTimeoutId = setTimeout(() => this.startObserving(retryCount - 1), delay);
    } else {
      // eslint-disable-next-line no-console
      console.log(LOG_MESSAGES.ALL_RETRIES_EXHAUSTED);
      this.retryTimeoutId = setTimeout(() => this.startObserving(RETRY_CONFIG.MAX_RETRIES), RETRY_CONFIG.INITIAL_DELAY);
    }
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

    // eslint-disable-next-line no-console
    console.log(LOG_MESSAGES.TAB_VISIBLE);
    this.startObserving();
  };

  private handlePageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted) return;

    // eslint-disable-next-line no-console
    console.log(LOG_MESSAGES.PAGE_RESTORED);
    this.startObserving();
  };

  private initVisibilityListener(): void {
    // Handling visibility change
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Handling page restoration from cache
    window.addEventListener("pageshow", this.handlePageShow);

    // Periodic check of the state: YouTube can replace the whole player, which
    // leaves the observer attached to a container no longer in the document.
    this.observerCheckIntervalId = setInterval(() => {
      if (!this.observedContainer?.isConnected) {
        // eslint-disable-next-line no-console
        console.log(LOG_MESSAGES.CONTAINER_LOST);
        this.startObserving();
      }
    }, RETRY_CONFIG.CHECK_INTERVAL);
  }

  private handleUrlChange = (): void => {
    const newHref = document.location.href;
    if (this.currentHref === newHref) return;

    this.currentHref = newHref;
    this.startObserving();
    // eslint-disable-next-line no-console
    console.log(LOG_MESSAGES.URL_CHANGED);
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
      const patchedPushState: typeof history.pushState = function (this: History, ...args) {
        originalPushState.apply(this, args);

        handleUrlChange();
      };

      const patchedReplaceState: typeof history.replaceState = function (this: History, ...args) {
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
    this.urlCheckIntervalId = setInterval(this.handleUrlChange, RETRY_CONFIG.URL_CHECK_INTERVAL);
  }

  private restoreHistoryMethods(): void {
    // Only unwrap what is still ours — another script may have patched on top,
    // and replacing that would break it.
    if (this.originalPushState && history.pushState === this.patchedPushState) {
      history.pushState = this.originalPushState;
    }

    if (this.originalReplaceState && history.replaceState === this.patchedReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
  }
}
