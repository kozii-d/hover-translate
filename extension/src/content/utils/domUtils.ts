import { CAPTION_WINDOW_CONTAINER } from "../consts/consts.ts";

/**
 * Whether a caption window sits in the upper half of the player. Takes the
 * window rather than finding one: with two speakers on screen, one caption at
 * the top and one at the bottom, the first window in the document is not
 * necessarily the one the tooltip belongs to.
 */
export function isCaptionWindowInUpperHalf(captionWindow: HTMLElement): boolean {
  const container = captionWindow.closest<HTMLElement>(`.${CAPTION_WINDOW_CONTAINER}`);

  if (!container) {
    return false;
  }

  const containerRect = container.getBoundingClientRect();
  const captionWindowRect = captionWindow.getBoundingClientRect();

  const containerCenterY = containerRect.top + containerRect.height / 2;

  return captionWindowRect.top + captionWindowRect.height / 2 < containerCenterY;
}

/**
 * Where our tooltips and cards go: the fullscreen element while there is one
 * (nothing outside it is drawn), the body otherwise.
 */
export function getOverlayContainer(): Element {
  return document.fullscreenElement ?? document.body;
}

export interface ViewportBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The part of `element` inside the window, in viewport coordinates, or null when none is. */
export function getVisibleRect(element: Element): ViewportBox | null {
  const rect = element.getBoundingClientRect();
  const box = {
    left: Math.max(rect.left, 0),
    top: Math.max(rect.top, 0),
    right: Math.min(rect.right, window.innerWidth),
    bottom: Math.min(rect.bottom, window.innerHeight),
  };

  return box.right > box.left && box.bottom > box.top ? box : null;
}

/**
 * Puts an absolutely positioned child of `container` at a point of the
 * viewport. The body scrolls with the page, so the scroll is added; the
 * fullscreen element is fixed to the viewport, so its own position is taken off.
 */
export function placeAt(element: HTMLElement, container: Element, x: number, y: number): void {
  const origin = container === document.body
    ? { left: -window.scrollX, top: -window.scrollY }
    : container.getBoundingClientRect();

  element.style.left = `${x - origin.left}px`;
  element.style.top = `${y - origin.top}px`;
}
