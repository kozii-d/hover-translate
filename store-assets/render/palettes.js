// Colours of the frame around the screenshots and of the promo images:
// YouTube's own, in its light and dark themes, as the extension follows them.
const YOUTUBE_RED = "#ff0033";

const PALETTES = {
  light: { bg: "#f2f2f2", "bg-2": "#ffffff", text: "#0f0f0f", muted: "#606060", accent: YOUTUBE_RED, surface: "#e5e5e5", shadow: "rgba(0,0,0,0.22)" },
  dark: { bg: "#0f0f0f", "bg-2": "#272727", text: "#f1f1f1", muted: "#aaaaaa", accent: YOUTUBE_RED, surface: "#272727", shadow: "rgba(0,0,0,0.6)" },
};

module.exports = { PALETTES };
