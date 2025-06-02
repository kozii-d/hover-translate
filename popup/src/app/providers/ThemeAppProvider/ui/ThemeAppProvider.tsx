import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppProvider } from "@toolpad/core";

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

interface ThemeAppProviderProps {
  children: ReactNode;
}

export const ThemeAppProvider: FC<ThemeAppProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<"light" | "dark">("light");

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
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setMode(mediaQuery.matches ? "dark" : "light");
    };

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider theme={theme}>
        {children}
      </AppProvider>
    </ThemeProvider>
  );
};