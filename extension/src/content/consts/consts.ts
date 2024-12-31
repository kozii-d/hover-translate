// CSS classes
export const TOOLTIP_CLASS = "custom-tooltip";
export const NOTIFICATION_TOOLTIP_CLASS = "custom-notification-tooltip";
export const TOOLTIP_WORD_CLASS = "custom-tooltip-word";
export const TOOLTIP_SELECTED_WORD_CLASS = "custom-tooltip-word-selected";

// YouTube classes
export const CAPTION_WINDOW_CONTAINER = "ytp-caption-window-container";
export const CAPTION_WINDOW = "caption-window";
export const CAPTION_SEGMENT = "ytp-caption-segment";

// Data attributes keys
export const DATA_ATTRIBUTES = {
  INDEX: "data-index",
};

interface TooltipSettings {
  fontFamily: {
    [key: string]: string;
  };
  fontColor: {
    [key: string]: string;
  };
  fontSize: {
    [key: string]: string;
  };
  backgroundColor: {
    [key: string]: string;
  };
  backgroundOpacity: {
    [key: string]: number;
  };
  characterEdgeStyle: {
    [key: string]: string;
  };
  fontOpacity: {
    [key: string]: number;
  };
}

export const TOOLTIP_SETTINGS: TooltipSettings = {
  fontFamily: {
    "monospaced-serif": "\"Courier New\", Courier, \"Nimbus Mono L\", \"Cutive Mono\", monospace",
    "proportional-serif": "\"Times New Roman\", Times, Georgia, Cambria, \"PT Serif Caption\", serif",
    "monospaced-sans-serif": "\"Deja Vu Sans Mono\", \"Lucida Console\", Monaco, Consolas, \"PT Mono\", monospace",
    "proportional-sans-serif": "\"YouTube Noto\", Roboto, Arial, Helvetica, Verdana, \"PT Sans Caption\", sans-serif",
    "casual": "\"Comic Sans MS\", Impact, Handlee, fantasy",
    "cursive": "\"Monotype Corsiva\", \"URW Chancery L\", \"Apple Chancery\", \"Dancing Script\", cursive",
    "small-capitals": "Arial, Helvetica, Verdana, \"Marcellus SC\", sans-serif",
  },
  fontColor: {
    white: "rgb(255, 255, 255)",
    yellow: "rgb(255, 255, 0)",
    green: "rgb(0, 255, 0)",
    cyan: "rgb(0, 255, 255)",
    blue: "rgb(0, 0, 255)",
    magenta: "rgb(255, 0, 255)",
    red: "rgb(255, 0, 0)",
    black:"rgb(8, 8, 8)",
  },
  fontSize: {
    "50%": "11.2667px",
    "75%": "16.9px",
    "100%": "22.5333px",
    "150%": "28.1667px",
    "200%": "33.8px",
    "300%": "39.4333px",
    "400%": "45.0667px",
  },
  backgroundColor: {
    white: "rgb(255, 255, 255)",
    yellow: "rgb(255, 255, 0)",
    green: "rgb(0, 255, 0)",
    cyan: "rgb(0, 255, 255)",
    blue: "rgb(0, 0, 255)",
    magenta: "rgb(255, 0, 255)",
    red: "rgb(255, 0, 0)",
    black:"rgb(8, 8, 8)",
  },
  backgroundOpacity: {
    "0%": 0,
    "25%": 0.25,
    "50%": 0.5,
    "75%": 0.75,
    "100%": 1,
  },
  characterEdgeStyle: {
    "none": "none",
    "drop-shadow": "rgb(34, 34, 34) 1.40833px 1.40833px 2.1125px, rgb(34, 34, 34) 1.40833px 1.40833px 2.81667px, rgb(34, 34, 34) 1.40833px 1.40833px 3.52083px",
    "raised": "rgb(34, 34, 34) 1px 1px 0px, rgb(34, 34, 34) 1.5px 1.5px 0px, rgb(34, 34, 34) 2px 2px 0px",
    "depressed": "rgb(204, 204, 204) 1px 1px 0px, rgb(34, 34, 34) -1px -1px 0px",
    "outline": "rgb(34, 34, 34) 0px 0px 1.40833px, rgb(34, 34, 34) 0px 0px 1.40833px, rgb(34, 34, 34) 0px 0px 1.40833px, rgb(34, 34, 34) 0px 0px 1.40833px, rgb(34, 34, 34) 0px 0px 1.40833px",
  },
  fontOpacity: {
    "25%": 0.25,
    "50%": 0.5,
    "75%": 0.75,
    "100%": 1,
  },
};

