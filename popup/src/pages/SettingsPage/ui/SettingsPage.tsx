import { FC, useCallback, useEffect, useState } from "react";
import { Language, AvailableLanguages, SettingsFormValues, Translator } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { useTranslation } from "react-i18next";
import { SettingsForm } from "./SettingsForm.tsx";
import { useNotification } from "@/app/providers/NotificationProvider";

const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState<SettingsFormValues>(initialFormValues);

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const loading = loadingLanguages || loadingSettings;

  const { t } = useTranslation("settings");

  const { set, get } = useStorage();

  const notification = useNotification();

  const fetchAvailableLanguages = useCallback(async (translator: Translator) => {
    setLoadingLanguages(true);
    try {
      const availableLanguages = await new Promise<AvailableLanguages>((resolve) => {
        chrome.runtime.sendMessage({ action: "getAvailableLanguages", value: translator },
          (response: { availableLanguages: AvailableLanguages } ) => {
            resolve(response.availableLanguages);
          });
      });
      setSourceLanguages(availableLanguages.sourceLanguages);
      setTargetLanguages(availableLanguages.targetLanguages);

      return availableLanguages;
    } catch (error) {
      const errorMessage = "Failed to fetch available languages";
      notification.show(errorMessage, { severity: "error" });
      console.error(errorMessage, error);
      throw error;
    } finally {
      setLoadingLanguages(false);
    }
  }, [notification]);

  const setInitialSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await get<SettingsFormValues>("settings", "sync");
      if (settings) {
        setInitialValues(settings);
        await fetchAvailableLanguages(settings.translator);
      }
    } catch (error) {
      const errorMessage = "Failed to get settings";
      notification.show(errorMessage, { severity: "error" });
      console.error(errorMessage, error);
    } finally {
      setLoadingSettings(false);
    }
  }, [fetchAvailableLanguages, get, notification]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: SettingsFormValues) => {
    try {
      await set<SettingsFormValues>("settings", values, "sync");
      setInitialValues(values);
    } catch (error) {
      const errorMessage = "Failed to save settings";
      notification.show(errorMessage, { severity: "error" });
      console.error(errorMessage, error);
      setInitialSettings();
    }
  }, [notification, set, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
      <SettingsForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        sourceLanguages={sourceLanguages}
        targetLanguages={targetLanguages}
        fetchAvailableLanguages={fetchAvailableLanguages}
        loading={loading}
      />
    </Page>
  );
};

export default SettingsPage;