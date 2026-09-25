import rgba from "color-rgba";
import alpha from "color-alpha";

import { CAPTION_SEGMENT, TOOLTIP_SETTINGS } from "../consts/consts.ts";
import { state } from "../state/stateManager.ts";

/**
 * Dresses a tooltip, a notification or the rating card in the viewer's
 * subtitle theme: the one set on the Customize page, or YouTube's own.
 */
export function styleTooltip(tooltip: HTMLElement): void {
  const captionSegment = document.querySelector<HTMLElement>(`.${CAPTION_SEGMENT}`);
  if (!captionSegment) return;

  const youtubeSubtitleContainerStyles = window.getComputedStyle(captionSegment);

  const {
    useYouTubeSettings,
    fontFamily,
    fontColor,
    fontOpacity,
    fontSize,
    backgroundColor,
    backgroundOpacity,
    characterEdgeStyle
  } = state.tooltipTheme;

  if (useYouTubeSettings) {
    tooltip.style.fontFamily = youtubeSubtitleContainerStyles.fontFamily;
    tooltip.style.color = youtubeSubtitleContainerStyles.color;
    tooltip.style.fontSize = youtubeSubtitleContainerStyles.fontSize;
    tooltip.style.fontVariant = youtubeSubtitleContainerStyles.fontVariant;
    tooltip.style.background = youtubeSubtitleContainerStyles.background;
    tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
    return;
  }

  if (fontFamily === "small-capitals") {
    tooltip.style.fontFamily = TOOLTIP_SETTINGS.fontFamily[fontFamily];
    tooltip.style.fontVariant = "small-caps";
  } else if (fontFamily === "auto") {
    tooltip.style.fontFamily = youtubeSubtitleContainerStyles.fontFamily;
  } else {
    tooltip.style.fontFamily = TOOLTIP_SETTINGS.fontFamily[fontFamily];
  }

  const newFontColor = fontColor === "auto" ? youtubeSubtitleContainerStyles.color : TOOLTIP_SETTINGS.fontColor[fontColor];
  const ytSubtitleContainerColor = rgba(youtubeSubtitleContainerStyles.color);
  if (ytSubtitleContainerColor.length) {
    const [, , , ytAlpha] = ytSubtitleContainerColor;
    tooltip.style.color = fontOpacity === "auto" ? alpha(newFontColor, ytAlpha) : alpha(newFontColor, TOOLTIP_SETTINGS.fontOpacity[fontOpacity]);
  }

  if (fontSize === "auto") {
    tooltip.style.fontSize = youtubeSubtitleContainerStyles.fontSize;
  } else {
    tooltip.style.fontSize = TOOLTIP_SETTINGS.fontSize[fontSize];
  }

  const newBackgroundColor = backgroundColor === "auto" ? youtubeSubtitleContainerStyles.backgroundColor : TOOLTIP_SETTINGS.backgroundColor[backgroundColor];
  const ytSubtitleContainerBackground = rgba(youtubeSubtitleContainerStyles.background);
  
  if (ytSubtitleContainerBackground.length) {
    const [, , , ytBackgroundAlpha] = ytSubtitleContainerBackground;
    tooltip.style.background = youtubeSubtitleContainerStyles.background;
    tooltip.style.backgroundColor = backgroundOpacity === "auto" ? alpha(newBackgroundColor, ytBackgroundAlpha) : alpha(newBackgroundColor, TOOLTIP_SETTINGS.backgroundOpacity[backgroundOpacity]);
  }

  if (characterEdgeStyle === "auto") {
    tooltip.style.textShadow = youtubeSubtitleContainerStyles.textShadow;
  } else {
    tooltip.style.textShadow = TOOLTIP_SETTINGS.characterEdgeStyle[characterEdgeStyle];
  }
}
