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