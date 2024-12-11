import {FC, ReactNode, useEffect, useMemo, useState} from "react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from "@mui/material/CssBaseline";
import {AppProvider} from "@toolpad/core";

interface ThemeAppProviderProps {
  children: ReactNode;
}

export const ThemeAppProvider: FC<ThemeAppProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const theme = useMemo(() => {
    return createTheme({ palette: { mode: mode } });
  }, [mode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setMode(mediaQuery.matches ? 'dark' : 'light');
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider theme={theme} >
        {children}
      </AppProvider>
    </ThemeProvider>
  );
};