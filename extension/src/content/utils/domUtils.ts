import { CAPTION_WINDOW_CONTAINER, CAPTION_WINDOW } from "../consts/consts.ts";

export function isCaptionWindowInUpperHalf(): boolean {
  const container = document.querySelector<HTMLElement>(`.${CAPTION_WINDOW_CONTAINER}`);
  const captionWindow = document.querySelector<HTMLElement>(`.${CAPTION_WINDOW}`);

  if (!container || !captionWindow) {
    return false;
  }

  const containerRect = container.getBoundingClientRect();
  const captionWindowRect = captionWindow.getBoundingClientRect();

  const containerCenterY = containerRect.top + containerRect.height / 2;

  return captionWindowRect.top + captionWindowRect.height / 2 < containerCenterY;
}