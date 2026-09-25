import rgba from "color-rgba";
import alpha from "color-alpha";

import { AD_SHOWING, RATING_CARD_CLASS, VIDEO_PLAYER } from "../consts/consts.ts";
import { VideoController } from "../core/videoController.ts";
import { state } from "../state/stateManager.ts";
import { getOverlayContainer, getVisibleRect, isCaptionWindowInUpperHalf, placeAt } from "../utils/domUtils.ts";
import { styleTooltip } from "../utils/tooltipTheme.ts";
import { StorageService } from "../../common/services/storageService.ts";
import { sendMessageToBackground } from "../../common/services/messagingService.ts";
import {
  RATING_PROMPT_DONE_KEY,
  RATING_PROMPT_VIDEO_SHOWN_KEY,
  getReviewPageUrl,
  isVideoRatingPromptDue,
} from "../../common/ratingPrompt.ts";

/** The watch page and embedded players; not Shorts, whose corners are YouTube's buttons, nor the miniplayer over the feed. */
const VIDEO_PAGE = /^\/(watch|embed)(\/|$)/;
/** Narrower players (the standard 560×315 embed) leave no room for readable text and buttons. */
const MIN_PLAYER_WIDTH = 640;
/** The theme's size up to this; 400 % made a card cover most of the video. */
const MAX_FONT_SIZE_PX = 20;
/** A transparent theme background would leave text and buttons over a moving picture. */
const MIN_BACKGROUND_ALPHA = 0.75;
/**
 * How long the card stays once the viewer carries on watching: counted only
 * while the video plays with neither the pointer nor the focus on the card,
 * so reading it on a paused video costs nothing.
 */
const HIDE_AFTER_MS = 10_000;
/** A press in the first moments was meant for the word under the pointer, not for the card. */
const ARM_DELAY_MS = 800;
/**
 * From the edges of the visible part of the player: clear of the embed's top
 * buttons and of the control bar. The card goes top right, or bottom left when
 * the captions are up there: the settings menu opens at the bottom right.
 */
const INSET = { side: 16, top: 56, bottom: 64 };

/**
 * The request for a rating on the video, shown once ever, when someone has
 * plainly got use out of the extension: with the save that brings the word
 * list to ten, or with a translation once thirty are cached (the callers,
 * `TooltipService`, decide which).
 *
 * It behaves like the rest of the extension: the pointer on it pauses the
 * video (with auto-pause on), the pointer leaving resumes it.
 */
export class RatingPromptService {
  private card: HTMLElement | null = null;
  private deciding = false;
  /** The player the word was saved in, and its video: the card sits outside it and cannot find them. */
  private player: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  /** Follows the player's size: fullscreen, theatre mode, a resized window. */
  private playerResizeObserver: ResizeObserver | null = null;
  /** Taken when the card appears: the caption window may be gone by the time the card has to move. */
  private captionsInUpperHalf = false;
  private shownAt = 0;
  private pointerInside = false;
  /** See `updateCountdown`. */
  private remainingMs = HIDE_AFTER_MS;
  private countdownStartedAt: number | null = null;
  private hideTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly videoController: VideoController,
    private readonly storageService: StorageService = new StorageService(),
  ) {}

  /**
   * Called with the caption window a word was saved or translated from.
   * Nothing is recorded unless the card is actually on screen: a card that
   * could not be shown waits for the next save or translation.
   */
  public async offer(captionWindow: HTMLElement): Promise<void> {
    if (this.card || this.deciding || !state.settings.showNotifications) return;
    if (!getReviewPageUrl(chrome.runtime.getURL(""), chrome.runtime.id)) return;

    const player = captionWindow.closest<HTMLElement>(`.${VIDEO_PLAYER}`);
    if (!player || !this.canShowOn(player)) return;

    this.deciding = true;
    try {
      // Read at the moment of deciding: another tab may have shown the card
      // while this one stayed open.
      const sync = (await this.storageService.get<Record<string, unknown>>(null, "sync")) ?? {};
      if (!isVideoRatingPromptDue(sync, Date.now())) return;

      if (!this.show(player, captionWindow)) return;

      await this.storageService.set(RATING_PROMPT_VIDEO_SHOWN_KEY, true, "sync");
    } catch (error) {
      console.error("Could not show the rating card", error);
    } finally {
      this.deciding = false;
    }
  }

  private canShowOn(player: HTMLElement): boolean {
    return VIDEO_PAGE.test(document.location.pathname)
      && !player.classList.contains(AD_SHOWING)
      && player.getBoundingClientRect().width >= MIN_PLAYER_WIDTH
      && document.visibilityState === "visible";
  }

  /** False, with nothing left behind, when the card does not fit on screen. */
  private show(player: HTMLElement, captionWindow: HTMLElement): boolean {
    const card = this.createCard();
    getOverlayContainer().appendChild(card);
    this.applyTheme(card);

    this.player = player;
    this.captionsInUpperHalf = isCaptionWindowInUpperHalf(captionWindow);
    if (!this.place(card)) {
      card.remove();
      this.player = null;
      return false;
    }

    card.style.visibility = "visible";

    this.card = card;
    this.video = player.querySelector("video");
    this.shownAt = performance.now();
    this.video?.addEventListener("play", this.updateCountdown);
    this.video?.addEventListener("pause", this.updateCountdown);
    this.playerResizeObserver = new ResizeObserver(this.handlePlayerResize);
    this.playerResizeObserver.observe(player);
    this.updateCountdown();

    return true;
  }

  /**
   * Puts the card into the current overlay container, in the corner of the
   * visible part of the player away from the captions. Whether it fits there.
   */
  private place(card: HTMLElement): boolean {
    const visiblePlayer = this.player && getVisibleRect(this.player);
    if (!visiblePlayer) return false;

    const container = getOverlayContainer();
    if (card.parentElement !== container) container.appendChild(card);
    card.style.left = "0";
    card.style.top = "0";

    const { width, height } = card.getBoundingClientRect();
    if (this.captionsInUpperHalf) {
      placeAt(card, container, visiblePlayer.left + INSET.side, visiblePlayer.bottom - INSET.bottom - height);
    } else {
      placeAt(card, container, visiblePlayer.right - INSET.side - width, visiblePlayer.top + INSET.top);
    }

    const rect = card.getBoundingClientRect();
    return rect.left >= visiblePlayer.left && rect.top >= visiblePlayer.top
      && rect.right <= visiblePlayer.right && rect.bottom <= visiblePlayer.bottom;
  }

  /** Wherever the player now is: into the fullscreen element and back, into a larger or smaller corner. */
  private handlePlayerResize = (): void => {
    if (this.card && !this.place(this.card)) this.removeCard();
  };

  private createCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = RATING_CARD_CLASS;
    card.style.visibility = "hidden";
    card.style.left = "0";
    card.style.top = "0";

    const text = document.createElement("div");
    text.setAttribute("role", "status");
    text.setAttribute("aria-live", "polite");
    text.textContent = chrome.i18n.getMessage("ratingPromptText");

    const actions = document.createElement("div");
    actions.className = `${RATING_CARD_CLASS}-actions`;
    actions.append(
      this.createButton(`${chrome.i18n.getMessage("ratingPromptRate")} ★`, this.rate),
      this.createButton(chrome.i18n.getMessage("ratingPromptNotNow"), this.dismiss),
    );

    card.append(text, actions);

    card.addEventListener("pointerenter", this.handlePointerEnter);
    card.addEventListener("pointerleave", this.handlePointerLeave);
    card.addEventListener("focusin", this.updateCountdown);
    card.addEventListener("focusout", this.updateCountdown);
    // In fullscreen the card goes into the fullscreen element, which may be
    // the player itself: a click would toggle playback there, and a double
    // click leave fullscreen.
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick"]) {
      card.addEventListener(type, (event) => event.stopPropagation());
    }

    return card;
  }

  /**
   * The card appears under a pointer that is busy clicking words, so the
   * buttons ignore its first moments. A press that began before the card was
   * there needs nothing more: the browser sends `click` to a button only when
   * both the press and the release were on it.
   */
  private createButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;

    // A mouse press would move the focus here, and the keys YouTube listens
    // for on the document (space, k, f) would then press this button.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (performance.now() - this.shownAt >= ARM_DELAY_MS) action();
    });

    return button;
  }

  /** The viewer's subtitle theme, within limits that keep the card small and legible. */
  private applyTheme(card: HTMLElement): void {
    styleTooltip(card);

    const style = window.getComputedStyle(card);
    if (parseFloat(style.fontSize) > MAX_FONT_SIZE_PX) {
      card.style.fontSize = `${MAX_FONT_SIZE_PX}px`;
    }

    const background = rgba(style.backgroundColor);
    if (background.length && background[3] < MIN_BACKGROUND_ALPHA) {
      card.style.backgroundColor = alpha(style.backgroundColor, MIN_BACKGROUND_ALPHA);
    }
  }

  private rate = async (): Promise<void> => {
    const video = this.video;
    // Before the new tab takes the pointer away from the card, or the video
    // would play on in the background tab.
    if (video) this.videoController.keepPaused(video);
    this.removeCard();

    // Left on purpose here rather than by however the browser reacts to the
    // tab switching.
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => { /* already left */ });
    }

    try {
      await this.storageService.set(RATING_PROMPT_DONE_KEY, true, "sync");
    } catch (error) {
      console.error("Could not remember that the rating request is done", error);
    }

    sendMessageToBackground({ action: "openReviewPage" })
      .catch((error) => console.error("Could not open the rating page", error));
  };

  private dismiss = (): void => {
    const pointerWasInside = this.pointerInside;
    this.removeCard();

    // The card is gone from under the pointer without a `pointerleave`: resume
    // as that event would have.
    if (pointerWasInside) this.videoController.handleVideoPlay();
  };

  private handlePointerEnter = (): void => {
    this.pointerInside = true;
    this.updateCountdown();
    this.videoController.pauseVideo(this.video);
  };

  private handlePointerLeave = (): void => {
    this.pointerInside = false;
    this.videoController.handleVideoPlay();
    this.updateCountdown();
  };

  /**
   * Runs the countdown while the video plays (or has ended: nothing will start
   * it again) with neither the pointer nor the focus on the card, and stops it
   * otherwise, keeping what is left.
   */
  private updateCountdown = (): void => {
    const running = Boolean(this.video && (!this.video.paused || this.video.ended))
      && !this.pointerInside
      && !this.card?.contains(document.activeElement);
    const startedAt = this.countdownStartedAt;

    if (running && startedAt === null) {
      this.countdownStartedAt = performance.now();
      this.hideTimeoutId = setTimeout(() => this.removeCard(), this.remainingMs);
    } else if (!running && startedAt !== null) {
      this.remainingMs -= performance.now() - startedAt;
      this.countdownStartedAt = null;
      clearTimeout(this.hideTimeoutId);
    }
  };

  /** Also when the pipeline is rebuilt, and when YouTube moves to another page: the card belongs to this one. */
  public removeCard(): void {
    clearTimeout(this.hideTimeoutId);
    this.video?.removeEventListener("play", this.updateCountdown);
    this.video?.removeEventListener("pause", this.updateCountdown);
    this.playerResizeObserver?.disconnect();
    this.playerResizeObserver = null;
    this.card?.remove();
    this.card = null;
    this.player = null;
    this.video = null;
    this.pointerInside = false;
    this.remainingMs = HIDE_AFTER_MS;
    this.countdownStartedAt = null;
  }
}
