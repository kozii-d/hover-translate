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

/** The near black and near white of `color="primary"` buttons: the page's text, not the red. */
const BUTTONS_COLOR = {
  light: { main: "rgb(15, 15, 15)", contained: "rgb(255, 255, 255)", hover: "rgba(15, 15, 15, 0.8)", tint: "rgba(15, 15, 15, 0.08)" },
  dark: { main: "rgb(241, 241, 241)", contained: "rgb(15, 15, 15)", hover: "rgba(241, 241, 241, 0.8)", tint: "rgba(241, 241, 241, 0.08)" },
} as const;

/**
 * The red of the HoverTranslate icon (#f61c0d), as dark or light as text
 * needs: 4.66:1 on white, and white on it as much; 5.70:1 on MUI's dark
 * background, with dark text on it (`contrastThreshold` below). The site has
 * its own steps of the same hue.
 */
const PRIMARY = { light: "#e41f0f", dark: "#ff4d40" } as const;

/** The dark text of `info` and `warning` outlined buttons in the light theme: MUI's own is under 4.5:1 on its alerts. */
const OUTLINED_TEXT_LIGHT = { info: "#01579b", warning: "#663c00" } as const;

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

  const theme = useMemo(() => {
    const buttons = BUTTONS_COLOR[mode];

    return createTheme({
      direction,
      palette: {
        mode,
        primary: { main: PRIMARY[mode] },
        // The text on a coloured background (a red button, the badge) as
        // readable as any other: MUI's default threshold of 3 puts white on
        // the dark theme's red error button at 3.68:1.
        contrastThreshold: 4.5,
      },
      components: {
        // No scroll lock under lists and dialogs: Chrome keeps the popup's
        // scrollbar under `overflow: hidden`, and the padding MUI adds in its
        // place widens the popup window. `Popover` (under `Menu` and `Select`)
        // passes its own `false` to `Modal`, so it needs the default too.
        MuiModal: {
          defaultProps: { disableScrollLock: true },
        },
        MuiPopover: {
          defaultProps: { disableScrollLock: true },
        },
        // The keyboard focus: an outline of the text's colour around the
        // control. Not `currentColor`: a contained button's is white on a
        // white page.
        MuiButtonBase: {
          styleOverrides: {
            root: ({ theme }) => ({
              "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 2 },
            }),
          },
        },
        // Links too, which are not ButtonBase (the browser's own ring otherwise).
        MuiLink: {
          styleOverrides: {
            root: ({ theme }) => ({
              "&:focus-visible, &.Mui-focusVisible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 2 },
            }),
          },
        },
        // Inside the ones that sit edge to edge. `&&`: over ButtonBase's own rule.
        MuiTab: { styleOverrides: { root: { "&&.Mui-focusVisible": { outlineOffset: -2 } } } },
        MuiListItemButton: { styleOverrides: { root: { "&&.Mui-focusVisible": { outlineOffset: -2 } } } },
        MuiMenuItem: { styleOverrides: { root: { "&&.Mui-focusVisible": { outlineOffset: -2 } } } },
        // A switch cuts off what is outside its box (`overflow: hidden`): the
        // outline goes round the thumb's halo, inside the box.
        MuiSwitch: { styleOverrides: { switchBase: { "&&.Mui-focusVisible": { outlineOffset: -2 } } } },
        // An alert's message box scrolls (`overflow: auto`) and would cut off
        // the outline of a button at its edge. `minWidth: 0` keeps a long
        // word from widening the alert, as the scroll box did.
        MuiAlert: { styleOverrides: { message: { overflow: "visible", minWidth: 0 } } },
        // Red is for an error alone: a focused field has the text's colour.
        MuiOutlinedInput: {
          styleOverrides: {
            root: ({ theme }) => ({
              "&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.text.primary },
            }),
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: ({ theme }) => ({
              "&.Mui-focused:not(.Mui-error)": { color: theme.palette.text.primary },
            }),
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              // Not on a disabled one, which keeps MUI's disabled colours.
              "&.MuiButton-contained.MuiButton-colorPrimary:not(.Mui-disabled)": {
                backgroundColor: buttons.main,
                color: buttons.contained,
                "&:hover": { backgroundColor: buttons.hover },
              },
              "&.MuiButton-outlined.MuiButton-colorPrimary:not(.Mui-disabled)": {
                borderColor: buttons.main,
                color: buttons.main,
                "&:hover": { backgroundColor: buttons.tint },
              },
              "&.MuiButton-text.MuiButton-colorPrimary:not(.Mui-disabled)": {
                color: buttons.main,
                "&:hover": { backgroundColor: buttons.tint },
              },
              // An outlined button's border is the colour of its text.
              "&.MuiButton-outlined:is(.MuiButton-colorInfo, .MuiButton-colorWarning):not(.Mui-disabled)": {
                borderColor: "currentColor",
              },
              ...(mode === "light" && {
                "&.MuiButton-outlined.MuiButton-colorInfo:not(.Mui-disabled)": { color: OUTLINED_TEXT_LIGHT.info },
                "&.MuiButton-outlined.MuiButton-colorWarning:not(.Mui-disabled)": { color: OUTLINED_TEXT_LIGHT.warning },
              }),
            },
          },
        },
      },
    });
  }, [mode, direction]);

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