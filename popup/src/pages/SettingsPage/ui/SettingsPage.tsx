import { Formik } from "formik";
import { SettingsForm } from "./SettingsForm.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { Language, AvailableLanguages, SettingsFormValues } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { useTranslation } from "react-i18next";

const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState<SettingsFormValues>(initialFormValues);

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const loading = loadingLanguages || loadingSettings;

  const { t } = useTranslation("settings");

  const { set, get } = useStorage();

  const setInitialSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await get<SettingsFormValues>("settings", "sync");
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
        chrome.runtime.sendMessage({ action: "getAvailableLanguages" }, (response: { availableLanguages: AvailableLanguages } ) => {
          setSourceLanguages(response.availableLanguages.sourceLanguages);
          setTargetLanguages(response.availableLanguages.targetLanguages);
        });
      } catch (error) {
        console.error("Failed to fetch source languages", error);
      } finally {
        setLoadingLanguages(false);
      }
    };

    fetchLanguagesData();
  }, []);

  const handleSubmit = useCallback((values: SettingsFormValues) => {
    return set<SettingsFormValues>("settings", values, "sync").then(setInitialSettings);
  }, [set, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
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

export default SettingsPage;