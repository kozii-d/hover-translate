// The values of each menu, as `tooltipTheme` stores them and the content script
// reads them, in the order of YouTube's caption options. Every menu also starts
// with "auto": take the value from YouTube's captions. The labels are built in
// `CustomizeForm`, in the popup's language.

export const FONT_FAMILIES = [
  "monospaced-serif",
  "proportional-serif",
  "monospaced-sans-serif",
  "proportional-sans-serif",
  "casual",
  "cursive",
  "small-capitals",
];
/** One list for the font and the background, as in YouTube's menu. */
export const COLORS = ["white", "yellow", "green", "cyan", "blue", "magenta", "red", "black"];
export const CHARACTER_EDGE_STYLES = ["none", "drop-shadow", "raised", "depressed", "outline"];

export const FONT_SIZES = ["50%", "75%", "100%", "150%", "200%", "300%", "400%"];
export const FONT_OPACITIES = ["25%", "50%", "75%", "100%"];
export const BACKGROUND_OPACITIES = ["0%", "25%", "50%", "75%", "100%"];
