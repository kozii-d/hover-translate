import Container from "@mui/material/Container";
import {Formik} from "formik";
import {SettingsForm} from "./SettingsForm.tsx";
import {FC, useCallback, useEffect, useState} from "react";
import {SettingsFormValues} from "../model/types/schema.ts";

const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState({ sourceLanguageCode: "", targetLanguageCode: "", autoPause: false });

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

  const handleSubmit = (values: SettingsFormValues) => {
    chrome.storage.sync.set({
      settings: values,
    }, () => {
      setInitialLanguages();
    });
  };

  return (
    <Container maxWidth={false} sx={{ padding: '16px', width: "100vw" }}>
      <Formik
        enableReinitialize
        component={SettingsForm}
        onSubmit={handleSubmit}
        initialValues={initialValues}
      />
    </Container>
  );
}

export default SettingsPage;