import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppProvider } from "@toolpad/core";
import { getFromStorage, setToStorage } from "@/shared/lib/helpers/storage.ts";
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

  const applyStoredTheme = useCallback((theme: PopupTheme | null) => {
    setStoredTheme(theme);
    writeCachedPopupTheme(theme);
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
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
    [mode]
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
    <ThemeModeContext.Provider value={themeMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppProvider theme={theme}>
          {children}
        </AppProvider>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};