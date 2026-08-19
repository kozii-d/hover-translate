import { FC, useCallback, useEffect, useState } from "react";
import { Language, AvailableLanguages, SettingsFormValues, Translator } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { sendMessage } from "@/shared/lib/helpers/sendMessage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import {
  FALLBACK_TRANSLATOR,
  getErrorMessage,
  getTranslatorLabel,
} from "../model/consts/translators.ts";
import { useTranslation } from "react-i18next";
import { SettingsForm } from "./SettingsForm.tsx";
import { useNotifications } from "@toolpad/core";

const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState<SettingsFormValues>(initialFormValues);

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState<boolean>(false);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const loading = loadingLanguages || loadingSettings;

  const { t } = useTranslation("settings");

  const { set, get } = useStorage();

  const notifications = useNotifications();

  /**
   * Rejects when the translator can't be reached, so callers can react instead
   * of waiting on a request that never settles.
   */
  const fetchAvailableLanguages = useCallback(async (translator: Translator) => {
    setLoadingLanguages(true);
    try {
      const { availableLanguages } = await sendMessage<{ availableLanguages: AvailableLanguages }>({
        action: "getAvailableLanguages",
        value: translator,
      });

      if (!availableLanguages?.sourceLanguages?.length || !availableLanguages?.targetLanguages?.length) {
        throw new Error("The translator returned no languages");
      }

      setSourceLanguages(availableLanguages.sourceLanguages);
      setTargetLanguages(availableLanguages.targetLanguages);

      return availableLanguages;
    } finally {
      setLoadingLanguages(false);
    }
  }, []);

  const setInitialSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await get<SettingsFormValues>("settings", "sync");
      if (!settings) {
        return;
      }

      setInitialValues(settings);

      try {
        await fetchAvailableLanguages(settings.translator);
      } catch (error) {
        // A saved translator that stopped working used to leave this page on its
        // skeleton forever, with reinstalling the extension as the only way out.
        // Report what went wrong and fall back to a translator that answers.
        console.error(`The ${settings.translator} translator is unavailable`, error);

        const canFallBack = settings.translator !== FALLBACK_TRANSLATOR;

        notifications.show(t(canFallBack ? "errors.translatorFallback" : "errors.translatorUnavailable", {
          translatorName: getTranslatorLabel(settings.translator),
          errorMessage: getErrorMessage(error),
          fallbackTranslatorName: getTranslatorLabel(FALLBACK_TRANSLATOR),
        }), { severity: "error", autoHideDuration: 10000 });

        if (canFallBack) {
          const fallbackSettings = { ...settings, translator: FALLBACK_TRANSLATOR };
          setInitialValues(fallbackSettings);
          await set<SettingsFormValues>("settings", fallbackSettings, "sync");
          await fetchAvailableLanguages(FALLBACK_TRANSLATOR);
        }
      }
    } catch (error) {
      const errorMessage = "Failed to get settings";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    } finally {
      setLoadingSettings(false);
    }
  }, [fetchAvailableLanguages, get, notifications, set, t]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: SettingsFormValues) => {
    try {
      await set<SettingsFormValues>("settings", values, "sync");
      setInitialValues(values);
    } catch (error) {
      const errorMessage = "Failed to save settings";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
      setInitialSettings();
    }
  }, [notifications, set, setInitialSettings]);

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
