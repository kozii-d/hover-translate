import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Language, AvailableLanguages, SettingsFormValues, Translator, ApiKeyPrompt } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { requestAvailableLanguages } from "@/shared/lib/helpers/translatorRequests.ts";
import { describeTranslatorError, isApiKeyProblem } from "@/shared/lib/helpers/translatorErrors.ts";
import { apiKeyService } from "@/shared/lib/helpers/apiKeys.ts";
import { isTranslatorError } from "@extension/common/translators/translatorError.ts";
import { isTranslatorWithdrawn, resolveTranslatorKey } from "@extension/common/translators/withdrawnTranslators.ts";
import { matchSelectedLanguages } from "../lib/helpers/findClosestLanguage.ts";
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
  const [apiKeyPrompt, setApiKeyPrompt] = useState<ApiKeyPrompt | null>(null);

  // The fallback notice on screen, if any. Loading the settings again (after a
  // failed save, or twice under StrictMode) replaces it instead of queueing a
  // second copy that would hold back every notification after it.
  const fallbackNoticeKey = useRef<string | null>(null);

  const { t } = useTranslation("settings");

  const { set, get } = useStorage();

  const notifications = useNotifications();

  /** Rejects when the lists are unusable, rather than leaving the selects empty. */
  const applyAvailableLanguages = useCallback((availableLanguages: AvailableLanguages) => {
    if (!availableLanguages?.sourceLanguages?.length || !availableLanguages?.targetLanguages?.length) {
      throw new Error("The translator returned no languages");
    }

    setSourceLanguages(availableLanguages.sourceLanguages);
    setTargetLanguages(availableLanguages.targetLanguages);
  }, []);

  /**
   * Rejects when the translator can't be reached, so callers can react instead
   * of waiting on a request that never settles. A translator that gave a reason
   * rejects with a `TranslatorError` carrying it.
   */
  const fetchAvailableLanguages = useCallback(async (translator: Translator) => {
    setLoadingLanguages(true);
    try {
      const availableLanguages = await requestAvailableLanguages(translator);
      applyAvailableLanguages(availableLanguages);

      return availableLanguages;
    } finally {
      setLoadingLanguages(false);
    }
  }, [applyAvailableLanguages]);

  /** Shows why the settings moved to another translator, replacing the previous notice. */
  const showFallbackNotice = useCallback((message: string, severity: "error" | "warning") => {
    if (fallbackNoticeKey.current) {
      notifications.close(fallbackNoticeKey.current);
    }

    const noticeKey = notifications.show(message, { severity, autoHideDuration: 10000 });
    fallbackNoticeKey.current = noticeKey;

    return noticeKey;
  }, [notifications]);

  /**
   * Saves the settings with `translator` in place of the one they had. The
   * languages move with the translator: a DeepL `en-US` or `zh-Hant` would
   * otherwise stay selected in a list that has no such entry.
   */
  const fallBackTo = useCallback(async (settings: SettingsFormValues, translator: Translator) => {
    const fallbackLanguages = await fetchAvailableLanguages(translator);
    const languages = matchSelectedLanguages(
      settings,
      fallbackLanguages,
      chrome.i18n.getUILanguage(),
      initialFormValues.targetLanguageCode,
    );

    const fallbackSettings: SettingsFormValues = {
      ...settings,
      translator,
      sourceLanguageCode: languages.sourceLanguageCode,
      targetLanguageCode: languages.targetLanguageCode,
    };
    setInitialValues(fallbackSettings);
    await set<SettingsFormValues>("settings", fallbackSettings, "sync");
  }, [fetchAvailableLanguages, set]);

  const setInitialSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const settings = await get<SettingsFormValues>("settings", "sync");
      if (!settings) {
        return;
      }

      setInitialValues(settings);

      // Taken out of this release (see `WITHDRAWN_TRANSLATORS`): there is
      // nothing the viewer could grant or fix, so they are told and moved to
      // the replacement right away.
      if (isTranslatorWithdrawn(settings.translator)) {
        const replacement = resolveTranslatorKey(settings.translator) as Translator;

        showFallbackNotice(t("errors.translatorWithdrawn", {
          translatorName: getTranslatorLabel(settings.translator),
          fallbackTranslatorName: getTranslatorLabel(replacement),
        }), "warning");

        await fallBackTo(settings, replacement);
        return;
      }

      try {
        await fetchAvailableLanguages(settings.translator);
      } catch (error) {
        // A saved translator that stopped working used to leave this page on its
        // skeleton forever, with reinstalling the extension as the only way out.
        // Report what went wrong and fall back to a translator that answers.
        console.error(`The ${settings.translator} translator is unavailable`, error);

        const canFallBack = settings.translator !== FALLBACK_TRANSLATOR;
        const translatorName = getTranslatorLabel(settings.translator);
        const fallbackTranslatorName = getTranslatorLabel(FALLBACK_TRANSLATOR);
        const reason = describeTranslatorError(t, error, translatorName);

        const noticeKey = showFallbackNotice(reason
          ? (canFallBack ? t("errors.translatorFallbackReason", { reason, fallbackTranslatorName }) : reason)
          : t(canFallBack ? "errors.translatorFallback" : "errors.translatorUnavailable", {
            translatorName,
            errorMessage: getErrorMessage(error),
            fallbackTranslatorName,
          }), "error");

        // A key that is missing on this device (the choice of translator syncs,
        // the key does not), was revoked, or lost its permission: open the form
        // right away, so fixing it is one step from here.
        if (isApiKeyProblem(error)) {
          // Only the permission is missing: the key itself is fine, so the form
          // comes filled in and one click grants access again.
          const initialApiKey = isTranslatorError(error) && error.code === "permission-missing"
            ? await apiKeyService.get(settings.translator).catch(() => null) ?? undefined
            : undefined;

          setApiKeyPrompt({ translator: settings.translator, error: reason, initialApiKey, noticeKey });
        }

        if (canFallBack) {
          await fallBackTo(settings, FALLBACK_TRANSLATOR);
        }
      }
    } catch (error) {
      const errorMessage = "Failed to get settings";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    } finally {
      setLoadingSettings(false);
    }
  }, [fallBackTo, fetchAvailableLanguages, get, notifications, showFallbackNotice, t]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  /** Saves and rejects on failure, for callers that have to know. */
  const saveSettings = useCallback(async (values: SettingsFormValues) => {
    await set<SettingsFormValues>("settings", values, "sync");
    setInitialValues(values);
  }, [set]);

  const handleSubmit = useCallback(async (values: SettingsFormValues) => {
    try {
      await saveSettings(values);
    } catch (error) {
      const errorMessage = "Failed to save settings";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
      setInitialSettings();
    }
  }, [notifications, saveSettings, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
      <SettingsForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        saveSettings={saveSettings}
        sourceLanguages={sourceLanguages}
        targetLanguages={targetLanguages}
        fetchAvailableLanguages={fetchAvailableLanguages}
        applyAvailableLanguages={applyAvailableLanguages}
        apiKeyPrompt={apiKeyPrompt}
        loading={loading}
      />
    </Page>
  );
};

export default SettingsPage;
