import { FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { useTranslation } from "react-i18next";
import { getFromStorage, setToStorage } from "@/shared/lib/helpers/storage.ts";
import { NotificationsProvider } from "@/shared/ui/Notifications/Notifications.tsx";
import {
  POPUP_THEME_STORAGE_KEY,
  PopupTheme,
  ThemeModeContext,
  isPopupTheme,
  readCachedPopupTheme,
  writeCachedPopupTheme,
} from "@/shared/lib/theme/popupTheme.ts";

const BUTTONS_COLOR = {
  contained: {
    light: {
      background: "rgb(15, 15, 15)",
      text: "rgb(255, 255, 255)",
      hoverText: "rgb(34, 34, 34)",
      hoverBackground: "rgba(15, 15, 15, 0.8)",
    },
    dark: {
      background: "rgb(241, 241, 241)",
      text: "rgb(15, 15, 15)",
      hoverText: "rgb(224, 224, 224)",
      hoverBackground: "rgba(241, 241, 241, 0.8)",
    },
  },
  outlined: {
    light: {
      background: "rgb(15, 15, 15)",
      text: "rgb(255, 255, 255)",
      hoverText: "rgb(34, 34, 34)",
      hoverBackground: "rgba(15, 15, 15, 0.08)",
    },
    dark: {
      background: "rgb(241, 241, 241)",
      text: "rgb(15, 15, 15)",
      hoverText: "rgb(224, 224, 224)",
      hoverBackground: "rgba(241, 241, 241, 0.08)",
    },
  },
  text: {
    light: {
      background: "rgb(15, 15, 15)",
      text: "rgb(255, 255, 255)",
      hoverText: "rgb(34, 34, 34)",
      hoverBackground: "rgba(15, 15, 15, 0.08)",
    },
    dark: {
      background: "rgb(241, 241, 241)",
      text: "rgb(15, 15, 15)",
      hoverText: "rgb(224, 224, 224)",
      hoverBackground: "rgba(241, 241, 241, 0.08)",
    },
  },
} as const;

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * MUI writes its styles left to right. For a language written right to left
 * they go through a cache whose stylis plugin mirrors them (left and right,
 * margins, translate). The left-to-right cache is set up like emotion's
 * default one, so every other language gets exactly the styles it had.
 *
 * Unlike MUI's example, the RTL cache has no stylis `prefixer` (vendor
 * prefixes): `stylis` ships no types, and Chrome 102+ and Firefox 115+ need
 * none of those prefixes.
 */
const LTR_CACHE = createCache({ key: "css" });
const RTL_CACHE = createCache({ key: "muirtl", stylisPlugins: [rtlPlugin] });

const getSystemMode = (): PopupTheme =>
  window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";

interface ThemeAppProviderProps {
  children: ReactNode;
}

export const ThemeAppProvider: FC<ThemeAppProviderProps> = ({ children }) => {
  // Both are read synchronously so that the first render already has the
  // right theme; the OS preference used to arrive in an effect, after a light
  // frame had been painted.
  const [storedTheme, setStoredTheme] = useState<PopupTheme | null>(readCachedPopupTheme);
  const [systemMode, setSystemMode] = useState<PopupTheme>(getSystemMode);
  // Set once the viewer or another context has chosen, so that the initial
  // storage read, if it resolves later, cannot bring back an older value.
  const storedThemeSettledRef = useRef(false);

  const mode = storedTheme ?? systemMode;

  const { i18n } = useTranslation("common", { useSuspense: false });
  // i18next knows which languages are written right to left (ar, he, fa, ur…),
  // but calls "no language yet" right to left too.
  const direction = i18n.language ? i18n.dir(i18n.language) : "ltr";

  // Before the paint, so the page and MUI never disagree on the side.
  useLayoutEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const applyStoredTheme = useCallback((theme: PopupTheme | null) => {
    setStoredTheme(theme);
    writeCachedPopupTheme(theme);
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        direction,
        palette: {
          mode,
          primary: {
            main: "rgb(255, 0, 51)",
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                "&.MuiButton-contained.MuiButton-colorPrimary": {
                  backgroundColor:
                    mode === "light"
                      ? BUTTONS_COLOR.contained.light.background
                      : BUTTONS_COLOR.contained.dark.background,
                  color:
                    mode === "light"
                      ? BUTTONS_COLOR.contained.light.text
                      : BUTTONS_COLOR.contained.dark.text,
                  "&:hover": {
                    backgroundColor:
                      mode === "light"
                        ? BUTTONS_COLOR.contained.light.hoverBackground
                        : BUTTONS_COLOR.contained.dark.hoverBackground,
                  },
                },
                "&.MuiButton-outlined.MuiButton-colorPrimary": {
                  borderColor:
                    mode === "light"
                      ? BUTTONS_COLOR.outlined.light.background
                      : BUTTONS_COLOR.outlined.dark.background,
                  color:
                    mode === "light"
                      ? BUTTONS_COLOR.outlined.light.background
                      : BUTTONS_COLOR.outlined.dark.background,
                  "&:hover": {
                    backgroundColor:
                      mode === "light"
                        ? BUTTONS_COLOR.outlined.light.hoverBackground
                        : BUTTONS_COLOR.outlined.dark.hoverBackground,
                  },
                },

                "&.MuiButton-text.MuiButton-colorPrimary": {
                  color:
                    mode === "light"
                      ? BUTTONS_COLOR.text.light.background
                      : BUTTONS_COLOR.text.dark.background,
                  "&:hover": {
                    backgroundColor:
                      mode === "light"
                        ? BUTTONS_COLOR.text.light.hoverBackground
                        : BUTTONS_COLOR.text.dark.hoverBackground,
                  },
                },
              }
            },
          },
        },
      }),
    [mode, direction]
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
    const handleChange = () => {
      setSystemMode(mediaQuery.matches ? "dark" : "light");
    };

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getFromStorage<unknown>(POPUP_THEME_STORAGE_KEY, "sync")
      .then((value) => {
        if (cancelled || storedThemeSettledRef.current) return;
        applyStoredTheme(isPopupTheme(value) ? value : null);
      })
      .catch((error) => {
        console.error("Failed to get popupTheme", error);
      });

    return () => {
      cancelled = true;
    };
  }, [applyStoredTheme]);

  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== "sync" || !(POPUP_THEME_STORAGE_KEY in changes)) return;

      const { newValue } = changes[POPUP_THEME_STORAGE_KEY];
      storedThemeSettledRef.current = true;
      applyStoredTheme(isPopupTheme(newValue) ? newValue : null);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [applyStoredTheme]);

  const toggleMode = useCallback(() => {
    const next: PopupTheme = mode === "dark" ? "light" : "dark";

    storedThemeSettledRef.current = true;
    applyStoredTheme(next);
    setToStorage(POPUP_THEME_STORAGE_KEY, next, "sync").catch((error) => {
      console.error("Failed to save popupTheme", error);
    });
  }, [mode, applyStoredTheme]);

  const themeMode = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <CacheProvider value={direction === "rtl" ? RTL_CACHE : LTR_CACHE}>
      <ThemeModeContext.Provider value={themeMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <NotificationsProvider>
            {children}
          </NotificationsProvider>
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </CacheProvider>
  );
};