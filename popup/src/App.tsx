import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { Formik } from 'formik';

import {useCallback, useEffect, useMemo, useState} from "react";
import {Settings} from "./Settings.tsx";

export interface SettingsFormValues {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  autoPause: boolean;
}

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [initialValues, setInitialValues] = useState({ sourceLanguageCode: "", targetLanguageCode: "", autoPause: false });

  const theme = useMemo(() => {
    return createTheme({ palette: { mode: mode } });
  }, [mode]);

  const setInitialLanguages = useCallback(() => {
    chrome.storage.sync.get(["settings"], (result) => {
      const { settings } = result;

      if (!settings) {
        return;
      }

      setInitialValues(settings);
    });
  }, []);

  useEffect(() => {
    setInitialLanguages();
  }, [setInitialLanguages]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setMode(mediaQuery.matches ? 'dark' : 'light');
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleSubmit = (values: SettingsFormValues) => {
    chrome.storage.sync.set({
      settings: values,
    }, () => {
      setInitialLanguages();
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} sx={{ padding: '16px', width: "100vw" }}>
        <Formik
          enableReinitialize
          component={Settings}
          onSubmit={handleSubmit}
          initialValues={initialValues}
        />
      </Container>
    </ThemeProvider>
  )
}

export default App
