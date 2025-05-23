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
  HISTORY_METHODS_ERROR: "[MutationObserverService] Failed to override history methods:"
} as const;

export class MutationObserverService {
  private observer: MutationObserver;
  private urlObserver?: MutationObserver;

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
   * Main callback called when DOM changes.
   */
  private handleMutations = (mutations: MutationRecord[]): void => {
    mutations.forEach((mutation) => {
      // 1. If new words are added to the captions, update the indexes and clear the selected words.
      this.checkForNewWords(mutation);

      // 2. Handle all added nodes.
      mutation.addedNodes.forEach((node) => {
        this.handleAddedNode(node);
      });

      // 3. Handle all removed nodes.
      mutation.removedNodes.forEach((node) => {
        this.handleRemovedNode(node);
      });
    });
  };

  /**
   * Checks if there is a new subtitle word (TOOLTIP_WORD_CLASS) in the added nodes.
   * If yes, clears the selected words and updates the indexes.
   * Clearing is necessary for auto-generated captions.
   */
  private checkForNewWords(mutation: MutationRecord): void {
    const nodesArray = Array.from(mutation.addedNodes);
    const hasNewWord = nodesArray.some(
      (node) =>
        node instanceof Element &&
        node.classList.contains(TOOLTIP_WORD_CLASS)
    );

    if (hasNewWord) {
      this.tooltipService.clearSelectedWords();
      // this.tooltipService.deleteActiveTooltip();
      this.subtitleCore.setWordsIndexes();
    }
  }

  /**
   * Handle added node:
   * - split captions into words,
   * - update caption window size,
   * - add events to the caption window (mouseenter/mouseleave).
   */
  private handleAddedNode(node: Node): void {
    // If it's an Element, check for caption segments inside
    if (node instanceof Element) {
      const segments = node.querySelectorAll(`.${CAPTION_SEGMENT}`);
      segments.forEach((segment) => {
        if (segment instanceof HTMLElement) {
          this.subtitleCore.splitCaptionIntoSpans(segment);
        }
      });
      this.subtitleCore.updateCaptionWindowSize();

      // If it's a caption window, add events for pause/play
      if (node.classList.contains(CAPTION_WINDOW)) {
        node.addEventListener("pointerenter", this.videoController.handleVideoPause);
        node.addEventListener("pointerleave", this.videoController.handleVideoPlay);
        node.addEventListener("pointerleave", this.subtitleCore.handlePointerLeaveOnCaptionWindow);
      }
    }

    // For auto-generated captions (TEXT_NODE inside CaptionSegment)
    if (node.nodeType === Node.TEXT_NODE) {
      const captionSegment = node.parentElement;
      if (captionSegment && captionSegment.classList.contains(CAPTION_SEGMENT)) {
        this.subtitleCore.splitCaptionIntoSpans(captionSegment);
      }
    }
  }

  /**
   * Handle removed node:
   * - remove events,
   * - delete tooltips and clear selected words.
   */
  private handleRemovedNode(node: Node): void {
    // If it's a caption window, remove events and delete tooltips
    if (node instanceof Element && node.classList.contains(CAPTION_WINDOW)) {
      node.removeEventListener("pointerenter", this.videoController.handleVideoPause);
      node.removeEventListener("pointerleave", this.videoController.handleVideoPlay);
      node.removeEventListener("pointerleave", this.subtitleCore.handlePointerLeaveOnCaptionWindow);
      this.tooltipService.deleteActiveTooltip();
      this.tooltipService.clearSelectedWords();
    }
  }

  /**
   * Starts observing the caption container.
   * Uses exponential backoff for retries with a maximum delay of 10 seconds.
   * If all retries are exhausted, starts a new retry cycle.
   * @param retryCount - The number of retries left.
   */
  private startObserving(retryCount: number = RETRY_CONFIG.MAX_RETRIES): void {
    this.stopObserving();

    const captionContainer = document.querySelector(`.${CAPTION_WINDOW_CONTAINER}`);
    if (captionContainer) {
      this.observer.observe(captionContainer, {
        childList: true,
        subtree: true,
      });
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
      setTimeout(() => this.startObserving(retryCount - 1), delay);
    } else {
      // eslint-disable-next-line no-console
      console.log(LOG_MESSAGES.ALL_RETRIES_EXHAUSTED);
      setTimeout(() => this.startObserving(RETRY_CONFIG.MAX_RETRIES), RETRY_CONFIG.INITIAL_DELAY);
    }
  }

  private stopObserving(): void {
    this.observer.disconnect();
  }

  private initVisibilityListener(): void {
    // Handling visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // eslint-disable-next-line no-console
        console.log(LOG_MESSAGES.TAB_VISIBLE);
        this.startObserving();
      }
    });

    // Handling page restoration from cache
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        // eslint-disable-next-line no-console
        console.log(LOG_MESSAGES.PAGE_RESTORED);
        this.startObserving();
      }
    });

    // Periodic check of the state
    setInterval(() => {
      if (!this.observer) {
        this.startObserving();
      }
    }, RETRY_CONFIG.CHECK_INTERVAL);
  }

  /**
   * Check for URL changes.
   */
  private initUrlObserver(): void {
    let oldHref = document.location.href;

    const handleUrlChange = () => {
      const newHref = document.location.href;
      if (oldHref !== newHref) {
        oldHref = newHref;
        this.startObserving();
        // eslint-disable-next-line no-console
        console.log(LOG_MESSAGES.URL_CHANGED);

      }
    };

    // A «hacky» way to watch for URL changes by observing <title> changes.
    const titleElement = document.querySelector("title");
    if (titleElement) {
      this.urlObserver = new MutationObserver(handleUrlChange);
      this.urlObserver.observe(titleElement, { childList: true });
    }

    // Additional handlers
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);


    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    try {
      history.pushState = function (...args) {
        originalPushState.apply(this, args);

        handleUrlChange();
      };

      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);

        handleUrlChange();
      };
    } catch (error) {
      console.error(LOG_MESSAGES.HISTORY_METHODS_ERROR, error);
    }

    // Periodic check
    setInterval(handleUrlChange, RETRY_CONFIG.URL_CHECK_INTERVAL);
  }
}