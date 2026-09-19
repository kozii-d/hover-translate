import { createContext, useContext } from "react";

export type PopupTheme = "light" | "dark";

/**
 * The viewer's explicit choice, in `sync` storage. The key is absent until the
 * theme toggle is first clicked, and absent means "follow the OS" — which is
 * what every version before the toggle did, so nothing is written on install
 * or update.
 */
export const POPUP_THEME_STORAGE_KEY = "popupTheme";

/**
 * A copy of the stored choice in `localStorage`, which, unlike
 * `chrome.storage`, can be read synchronously: the first render already has
 * the right theme instead of flashing the OS one.
 */
export const POPUP_THEME_CACHE_KEY = "hoverTranslatePopupTheme";

export const isPopupTheme = (value: unknown): value is PopupTheme =>
  value === "light" || value === "dark";

export const readCachedPopupTheme = (): PopupTheme | null => {
  try {
    const value = localStorage.getItem(POPUP_THEME_CACHE_KEY);
    return isPopupTheme(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeCachedPopupTheme = (theme: PopupTheme | null) => {
  try {
    if (theme) {
      localStorage.setItem(POPUP_THEME_CACHE_KEY, theme);
    } else {
      localStorage.removeItem(POPUP_THEME_CACHE_KEY);
    }
  } catch {
    // The cache only saves a flash on open; storage stays the source of truth.
  }
};

interface ThemeModeContextValue {
  mode: PopupTheme;
  toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useThemeMode must be used within ThemeAppProvider");
  }

  return context;
};
