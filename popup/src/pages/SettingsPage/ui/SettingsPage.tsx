import { Formik } from "formik";
import { SettingsForm } from "./SettingsForm.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { Language, LanguageResponse, SettingsFormValues } from "../model/types/schema.ts";
import { api } from "@/shared/api/api.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";

export const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState<SettingsFormValues>({
    sourceLanguageCode: "",
    targetLanguageCode: "",
    autoPause: false
  });

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const loading = loadingLanguages || loadingSettings;
  
  const { set, get } = useStorage();

  const setInitialSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await get<SettingsFormValues>("settings");
      if (settings) {
        setInitialValues(settings);
      }
    } catch (error) {
      console.error("Failed to get settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  }, [get]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  useEffect(() => {
    const fetchLanguagesData = async () => {
      setLoadingLanguages(true);
      try {
        const response = await api.get<LanguageResponse>("/translation/languages");
        setSourceLanguages(response.data.sourceLanguages);
        setTargetLanguages(response.data.targetLanguages);
      } catch (error) {
        console.error("Failed to fetch source languages", error);
      } finally {
        setLoadingLanguages(false);
      }
    };

    fetchLanguagesData();
  }, []);

  const handleSubmit = useCallback((values: SettingsFormValues) => {
    return set<SettingsFormValues>("settings", values).then(setInitialSettings);
  }, [set, setInitialSettings]);

  return (
    <Page title="Settings">
      <Formik
        enableReinitialize
        onSubmit={handleSubmit}
        initialValues={initialValues}
      >
        {props => (
          <SettingsForm
            {...props}
            sourceLanguages={sourceLanguages}
            targetLanguages={targetLanguages}
            loading={loading}
          />
        )}
      </Formik>
    </Page>
  );
};