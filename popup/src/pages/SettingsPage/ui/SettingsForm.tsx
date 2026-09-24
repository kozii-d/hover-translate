import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import Collapse from "@mui/material/Collapse";

import {
  ApiKeyPrompt,
  AvailableLanguages,
  Language,
  LeftClickAction,
  SettingsFormValues,
  Translator,
} from "../model/types/schema.ts";
import { SettingsFormSkeleton } from "./skeletons/SettingsFormSkeleton.tsx";
import { ContextHint } from "./ContextHint.tsx";
import { DismissibleTip } from "@/shared/ui/DismissibleTip/DismissibleTip.tsx";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { useTranslation } from "react-i18next";
import { MenuItemType } from "@/shared/types/types.ts";
import { useNotifications } from "@toolpad/core";
import {
  FALLBACK_TRANSLATOR,
  TRANSLATORS_OPTIONS,
  getErrorMessage,
  getTranslatorLabel,
} from "../model/consts/translators.ts";
import { ensureTranslatorPermissions } from "@/shared/lib/helpers/permissions.ts";
import {
  requestApiKeyRemoval,
  requestApiKeySave,
  requestApiKeyVerification,
} from "@/shared/lib/helpers/translatorRequests.ts";
import { describeTranslatorError, isApiKeyProblem } from "@/shared/lib/helpers/translatorErrors.ts";
import {
  apiKeyService,
  clearApiKeyDraft,
  discardApiKeyDraft,
  loadApiKeyDraft,
  saveApiKeyDraft,
} from "@/shared/lib/helpers/apiKeys.ts";
import { requiresApiKey } from "@extension/common/translators/apiKeyProviders.ts";
import { TranslatorError } from "@extension/common/translators/translatorError.ts";
import { isTranslatorWithdrawn } from "@extension/common/translators/withdrawnTranslators.ts";
import { StoredApiKeys } from "@extension/common/services/apiKeyService.ts";
import { ApiKeyForm, ApiKeyStatus } from "@/features/TranslatorApiKey";
import {
  SelectedLanguagesMatch,
  findClosestLanguage,
  matchSelectedLanguages,
} from "../lib/helpers/findClosestLanguage.ts";

interface SettingsFormProps {
  initialValues: SettingsFormValues;
  onSubmit: (values: SettingsFormValues) => Promise<void>;
  /** Saves like `onSubmit`, but rejects on failure instead of reporting it. */
  saveSettings: (values: SettingsFormValues) => Promise<void>;
  sourceLanguages: Language[];
  targetLanguages: Language[];
  fetchAvailableLanguages: (translator: Translator) => Promise<AvailableLanguages>;
  applyAvailableLanguages: (availableLanguages: AvailableLanguages) => void;
  /** Opens the API key form from outside — the stored key stopped working. */
  apiKeyPrompt: ApiKeyPrompt | null;
  loading: boolean;
}

export const SettingsForm: FC<SettingsFormProps> = ({
  initialValues,
  onSubmit,
  saveSettings,
  sourceLanguages,
  targetLanguages,
  fetchAvailableLanguages,
  applyAvailableLanguages,
  apiKeyPrompt,
  loading,
}) => {
  const { t } = useTranslation("settings");
  const { control, handleSubmit, setValue, getValues, watch, reset } = useForm<SettingsFormValues>({
    defaultValues: initialValues,
  });

  const notifications = useNotifications();

  // The keys stored on this device, read up front: picking a translator has to
  // know synchronously whether it can switch or has to ask for a key, because
  // the permission request that switching starts needs the user gesture.
  const [apiKeys, setApiKeys] = useState<StoredApiKeys>({});
  // Until then `apiKeys` is empty whatever is stored, and anything that tells
  // a viewer with a key from one without would say the wrong thing first.
  const [apiKeysLoaded, setApiKeysLoaded] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyPrompt | null>(null);

  const currentTranslator = watch("translator");
  const alwaysMultipleSelection = watch("alwaysMultipleSelection");

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    apiKeyService.getAll()
      .then(setApiKeys)
      .catch((error) => console.error("Could not read the stored API keys", error))
      .finally(() => setApiKeysLoaded(true));

    // The popup was closed while a key was being connected — most likely by
    // Firefox showing the permission prompt. Pick up where the viewer left off.
    loadApiKeyDraft().then((draft) => {
      if (draft && requiresApiKey(draft.translatorKey)) {
        setApiKeyForm((openForm) => openForm ?? {
          translator: draft.translatorKey as Translator,
          initialApiKey: draft.apiKey,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (apiKeyPrompt) {
      setApiKeyForm(apiKeyPrompt);
    }
  }, [apiKeyPrompt]);

  // One instance for both lists: building `Intl.DisplayNames` is expensive and the
  // translators offer close to two hundred languages each.
  const languageNames = useMemo(() => new Intl.DisplayNames("en", { type: "language" }), []);

  const getLanguageLabel = useCallback((language: Language) =>
    language.name || languageNames.of(language.code) || language.code, [languageNames]);

  const sourceOptions = useMemo(() => {
    const result = sourceLanguages.map((language) => ({
      value: language.code,
      label: getLanguageLabel(language),
    }));
    result.unshift({ value: "auto", label: "Auto" });
    return result;
  }, [getLanguageLabel, sourceLanguages]);

  const targetOptions = useMemo(() => {
    return targetLanguages.map((language) => ({
      value: language.code,
      label: getLanguageLabel(language),
    }));
  }, [getLanguageLabel, targetLanguages]);

  const translatorOptions = useMemo<MenuItemType<Translator>[]>(() =>
    TRANSLATORS_OPTIONS.filter((option) => !isTranslatorWithdrawn(option.value)).map((option) => ({
      ...option,
      description: requiresApiKey(option.value) && !apiKeys[option.value]
        ? t("apiKey.requiredHint")
        : undefined,
    })), [apiKeys, t]);

  const leftClickActionOptions: MenuItemType<LeftClickAction>[]  = [
    { value: "save-to-dictionary", label: t("fields.leftClickAction.options.saveToDictionary") },
    { value: "copy-original", label: t("fields.leftClickAction.options.copyOriginal") },
    { value: "copy-translation", label: t("fields.leftClickAction.options.copyTranslation") },
    { value: "nothing", label: t("fields.leftClickAction.options.nothing") },
  ];

  /**
   * Tells the viewer when a change of translator had to change the language
   * itself. A language the new translator only spells differently (`en` /
   * `en-US`, `zh-CN` / `zh-Hans`) is carried over silently.
   */
  const reportLanguageChanges = useCallback((
    previous: { sourceLanguageCode: string; targetLanguageCode: string },
    match: SelectedLanguagesMatch,
    translator: Translator,
  ) => {
    const translatorName = getTranslatorLabel(translator);

    if (match.sourceReset) {
      notifications.show(t("errors.sourceLanguageCode", {
        incorrectLanguage: sourceOptions.find((option) => option.value === previous.sourceLanguageCode)?.label || "Unknown",
        translatorName,
        defaultLanguage: "'Auto'",
      }), { severity: "warning", autoHideDuration: 5000 });
    }

    if (match.targetReplacement) {
      notifications.show(t("errors.targetLanguageCode", {
        incorrectLanguage: targetOptions.find((option) => option.value === previous.targetLanguageCode)?.label || "Unknown",
        translatorName,
        defaultLanguage: getLanguageLabel(match.targetReplacement),
      }), { severity: "warning", autoHideDuration: 5000 });
    }
  }, [getLanguageLabel, notifications, sourceOptions, t, targetOptions]);

  /** The selected languages as the translator whose lists these are spells them. */
  const matchLanguages = useCallback((availableLanguages: AvailableLanguages) => {
    const previous = {
      sourceLanguageCode: getValues("sourceLanguageCode"),
      targetLanguageCode: getValues("targetLanguageCode"),
    };

    const match = matchSelectedLanguages(
      previous,
      availableLanguages,
      chrome.i18n.getUILanguage(),
      initialFormValues.targetLanguageCode,
    );

    return { previous, match };
  }, [getValues]);

  /** Keeps the selected languages across a change of translator. */
  const checkSelectedLanguages = useCallback((availableLanguages: AvailableLanguages) => {
    const { previous, match } = matchLanguages(availableLanguages);

    if (match.sourceLanguageCode !== previous.sourceLanguageCode) {
      setValue("sourceLanguageCode", match.sourceLanguageCode, { shouldDirty: true });
    }
    if (match.targetLanguageCode !== previous.targetLanguageCode) {
      setValue("targetLanguageCode", match.targetLanguageCode, { shouldDirty: true });
    }

    reportLanguageChanges(previous, match, getValues("translator"));
  }, [getValues, matchLanguages, reportLanguageChanges, setValue]);

  /** A reason the viewer can act on when the translator gave one, else the raw message. */
  const describeError = useCallback((error: unknown, translator: Translator) =>
    describeTranslatorError(t, error, getTranslatorLabel(translator)) ?? getErrorMessage(error), [t]);

  /**
   * Switches to another translator: permissions first (the prompt needs the
   * user gesture this is called from), then its languages, then saving. On
   * failure the previous translator stays selected, since saving one that
   * cannot answer would break translating on every video.
   */
  const switchTranslator = useCallback((nextTranslator: Translator, previousTranslator: Translator) => {
    setValue("translator", nextTranslator, { shouldDirty: true });

    return ensureTranslatorPermissions(nextTranslator)
      .then((granted) => {
        if (!granted) {
          throw new TranslatorError("permission-missing", `Access to ${nextTranslator} was not granted`);
        }
        return fetchAvailableLanguages(nextTranslator);
      })
      .then((availableLanguages) => {
        checkSelectedLanguages(availableLanguages);
        return handleSubmit(onSubmit)();
      })
      .catch((error) => {
        console.error(`Failed to switch to the ${nextTranslator} translator`, error);
        setValue("translator", previousTranslator, { shouldDirty: true });

        // Something the key form fixes: show it with the reason instead of a
        // notification that disappears.
        if (requiresApiKey(nextTranslator) && isApiKeyProblem(error)) {
          setApiKeyForm({ translator: nextTranslator, error: describeError(error, nextTranslator) });
          return;
        }

        const reason = describeTranslatorError(t, error, getTranslatorLabel(nextTranslator));
        const previousTranslatorName = getTranslatorLabel(previousTranslator);

        notifications.show(reason
          ? t("errors.translatorSwitchFailedReason", { reason, previousTranslatorName })
          : t("errors.translatorSwitchFailed", {
            translatorName: getTranslatorLabel(nextTranslator),
            errorMessage: getErrorMessage(error),
            previousTranslatorName,
          }), { severity: "error", autoHideDuration: 10000 });
      });
  }, [checkSelectedLanguages, describeError, fetchAvailableLanguages, handleSubmit, notifications, onSubmit, setValue, t]);

  const handleTranslatorChange = (nextTranslator: Translator) => {
    const previousTranslator = getValues("translator");

    if (nextTranslator === previousTranslator) return;

    // Nothing to switch to yet: the select stays where it was and the form
    // asks for the key. Switching happens once the key has been checked.
    if (requiresApiKey(nextTranslator) && !apiKeys[nextTranslator]) {
      setApiKeyForm({ translator: nextTranslator });
      return;
    }

    setApiKeyForm(null);
    switchTranslator(nextTranslator, previousTranslator);
  };

  /** See `ApiKeyPrompt.noticeKey`. */
  const dismissPromptNotice = () => {
    if (apiKeyForm?.noticeKey) {
      notifications.close(apiKeyForm.noticeKey);
    }
  };

  /**
   * Checks the key, and only then saves it and switches to its translator.
   * Rejects with the message the form shows under the field.
   */
  const connectApiKey = async (translator: Translator, apiKey: string) => {
    // Both started synchronously, inside the gesture: the draft survives the
    // popup being closed by the permission prompt, the prompt needs the gesture.
    saveApiKeyDraft({ translatorKey: translator, apiKey });
    const permissionRequest = ensureTranslatorPermissions(translator);
    dismissPromptNotice();

    try {
      if (!(await permissionRequest)) {
        throw new Error(t("apiKey.errors.permissionDenied", { translatorName: getTranslatorLabel(translator) }));
      }

      let verification;
      try {
        verification = await requestApiKeyVerification(translator, apiKey);
      } catch (error) {
        console.warn(`The ${translator} API key could not be verified`, error);
        throw new Error(describeError(error, translator));
      }

      try {
        await requestApiKeySave(translator, apiKey);
      } catch (error) {
        console.error(`Could not save the ${translator} API key`, error);
        throw new Error(t("apiKey.errors.saveFailed"));
      }

      setApiKeys((keys) => ({ ...keys, [translator]: apiKey }));

      // Saved before anything on screen changes: if the settings cannot be
      // written, the form stays open with the reason, the checked key stays
      // stored, and "Connect" simply tries again.
      const { previous, match } = matchLanguages(verification.availableLanguages);
      const nextValues: SettingsFormValues = {
        ...getValues(),
        translator,
        sourceLanguageCode: match.sourceLanguageCode,
        targetLanguageCode: match.targetLanguageCode,
      };

      try {
        await saveSettings(nextValues);
      } catch (error) {
        console.error(`Could not switch the settings to ${translator}`, error);
        throw new Error(t("apiKey.errors.settingsSaveFailed"));
      }

      applyAvailableLanguages(verification.availableLanguages);
      reset(nextValues);
      reportLanguageChanges(previous, match, translator);

      setApiKeyForm(null);
      notifications.show(t("apiKey.notifications.connected", { translatorName: getTranslatorLabel(translator) }), {
        severity: "success",
        autoHideDuration: 4000,
      });
    } finally {
      discardApiKeyDraft();
    }
  };

  const removeApiKey = async (translator: Translator) => {
    dismissPromptNotice();

    try {
      // The draft may hold the same key (restored after the popup closed on a
      // permission prompt); "removed from this device" has to cover it too.
      await Promise.all([requestApiKeyRemoval(translator), clearApiKeyDraft()]);
    } catch (error) {
      console.error(`Could not remove the ${translator} API key`, error);
      notifications.show(t("apiKey.errors.removeFailed"), { severity: "error", autoHideDuration: 5000 });
      return;
    }

    setApiKeys((keys) => {
      const remainingKeys = { ...keys };
      delete remainingKeys[translator];
      return remainingKeys;
    });
    setApiKeyForm(null);

    const wasActive = getValues("translator") === translator;

    notifications.show(t(wasActive ? "apiKey.notifications.removed" : "apiKey.notifications.removedFromDevice", {
      translatorName: getTranslatorLabel(translator),
      fallbackTranslatorName: getTranslatorLabel(FALLBACK_TRANSLATOR),
    }), { severity: "info", autoHideDuration: 5000 });

    if (wasActive) {
      await switchTranslator(FALLBACK_TRANSLATOR, translator);
    }
  };

  const handleChangeSwitch = useCallback((field: keyof SettingsFormValues, value: boolean) => {
    setValue(field, value, { shouldDirty: true });
    handleSubmit(onSubmit)();
  }, [onSubmit, setValue, handleSubmit]);

  /**
   * Back to the default translator with its own languages: the lists on screen
   * may be another translator's, and picking the viewer's language from them
   * saved a code the default translator does not list.
   */
  const resetFormToDefault = useCallback(async () => {
    setApiKeyForm(null);

    try {
      const defaultLanguages = await fetchAvailableLanguages(initialFormValues.translator);
      const userLanguage = chrome.i18n.getUILanguage();
      const userTargetLanguage = findClosestLanguage(userLanguage, defaultLanguages.targetLanguages, userLanguage);

      const newValues = {
        ...initialFormValues,
        targetLanguageCode: userTargetLanguage?.code ?? initialFormValues.targetLanguageCode,
      };

      reset(newValues);
      await onSubmit(newValues);
    } catch (error) {
      console.error("Failed to reset the settings", error);
      notifications.show(t("errors.translatorUnavailable", {
        translatorName: getTranslatorLabel(initialFormValues.translator),
        errorMessage: getErrorMessage(error),
      }), { severity: "error", autoHideDuration: 10000 });
    }
  }, [fetchAvailableLanguages, notifications, onSubmit, reset, t]);

  if (loading) {
    return <SettingsFormSkeleton/>;
  }

  const currentApiKey = apiKeys[currentTranslator];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Controller
          name="sourceLanguageCode"
          control={control}
          render={({ field }) => (
            <SettingsSelect
              id="sourceLanguageCode"
              label={t("fields.sourceLanguageCode.label")}
              tooltip={t("fields.sourceLanguageCode.tooltip")}
              value={field.value}
              onChange={(value) => {
                setValue("sourceLanguageCode", value, { shouldDirty: true });
                handleSubmit(onSubmit)();
              }}
              options={sourceOptions}
            />
          )}
        />
        <Controller
          name="targetLanguageCode"
          control={control}
          render={({ field }) => (
            <SettingsSelect
              id="targetLanguageCode"
              label={t("fields.targetLanguageCode.label")}
              tooltip={t("fields.targetLanguageCode.tooltip")}
              value={field.value}
              onChange={(value) => {
                setValue("targetLanguageCode", value, { shouldDirty: true });
                handleSubmit(onSubmit)();
              }}
              options={targetOptions}
            />
          )}
        />
        <Controller
          name="translator"
          control={control}
          render={({ field }) => (
            <SettingsSelect
              id="translator"
              label={t("fields.translator.label")}
              tooltip={t("fields.translator.tooltip")}
              value={field.value}
              onChange={(value) => handleTranslatorChange(value as Translator)}
              options={translatorOptions}
            />
          )}
        />
        <Collapse in={Boolean(apiKeyForm)} unmountOnExit>
          {apiKeyForm && (
            <ApiKeyForm
              // A fresh form for every prompt, so a stale key or error never
              // carries over from the previous one.
              key={`${apiKeyForm.translator}-${apiKeyForm.error ?? ""}-${apiKeyForm.initialApiKey ?? ""}`}
              translatorKey={apiKeyForm.translator}
              translatorName={getTranslatorLabel(apiKeyForm.translator)}
              initialApiKey={apiKeyForm.initialApiKey}
              initialError={apiKeyForm.error}
              onConnect={(apiKey) => connectApiKey(apiKeyForm.translator, apiKey)}
              // A stored key that stopped working has to be removable from
              // here too: this form is the only place it shows up once the
              // translator has fallen back.
              onRemove={apiKeys[apiKeyForm.translator] ? () => removeApiKey(apiKeyForm.translator) : undefined}
              removeDescription={currentTranslator === apiKeyForm.translator
                ? t("apiKey.modals.remove.description", { fallbackTranslatorName: getTranslatorLabel(FALLBACK_TRANSLATOR) })
                : t("apiKey.modals.remove.descriptionInactive")}
              onCancel={() => {
                dismissPromptNotice();
                discardApiKeyDraft();
                setApiKeyForm(null);
              }}
            />
          )}
        </Collapse>
        {!apiKeyForm && requiresApiKey(currentTranslator) && currentApiKey && (
          <ApiKeyStatus
            translatorKey={currentTranslator}
            translatorName={getTranslatorLabel(currentTranslator)}
            fallbackTranslatorName={getTranslatorLabel(FALLBACK_TRANSLATOR)}
            apiKey={currentApiKey}
            onChangeKey={() => setApiKeyForm({ translator: currentTranslator })}
            onRemoveKey={() => removeApiKey(currentTranslator)}
          />
        )}
        {apiKeysLoaded && !apiKeyForm && currentTranslator !== "deepl" && (
          <ContextHint
            hasApiKey={Boolean(apiKeys.deepl)}
            onSelectDeepL={() => handleTranslatorChange("deepl")}
          />
        )}
        {/* With the setting on, Shift is not needed and the tip would suggest
            turning on what already is. */}
        {!alwaysMultipleSelection && (
          <DismissibleTip storageKey="multipleSelectionTipDismissed" closeText={t("tips.dismiss")}>
            {t("tips.multipleSelection")}
          </DismissibleTip>
        )}
        <Controller
          name="autoPause"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth title={t("fields.autoPause.tooltip")}>
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => handleChangeSwitch("autoPause", checked)}
                  />
                }
                label={t("fields.autoPause.label")}
              />
              <FormHelperText>
                {t("fields.autoPause.helperText")}
              </FormHelperText>
            </FormControl>
          )}
        />
        <Controller
          name="alwaysMultipleSelection"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth title={t("fields.alwaysMultipleSelection.tooltip")}>
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => handleChangeSwitch("alwaysMultipleSelection", checked)}
                  />
                }
                label={t("fields.alwaysMultipleSelection.label")}
              />
              <FormHelperText>
                {t("fields.alwaysMultipleSelection.helperText")}
              </FormHelperText>
            </FormControl>
          )}
        />
        <Controller
          name="leftClickAction"
          control={control}
          render={({ field }) => (
            <SettingsSelect
              id="leftClickAction"
              label={t("fields.leftClickAction.label")}
              tooltip={t("fields.leftClickAction.tooltip")}
              value={field.value}
              onChange={(value) => {
                setValue("leftClickAction", value as LeftClickAction, { shouldDirty: true });
                handleSubmit(onSubmit)();
              }}
              options={leftClickActionOptions}
            />
          )}
        />
        <Controller
          name="showNotifications"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth title={t("fields.showNotifications.tooltip")}>
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => handleChangeSwitch("showNotifications", checked)}
                  />
                }
                label={t("fields.showNotifications.label")}
              />
              <FormHelperText>
                {t("fields.showNotifications.helperText")}
              </FormHelperText>
            </FormControl>
          )}
        />
        <ConfirmationModal
          trigger={(
            <Button
              variant="text"
              color="error"
              fullWidth
              title={t("actions.reset.tooltip")}
            >
              {t("actions.reset.text")}
            </Button>
          )}
          title={t("modals.reset.title")}
          description={t("modals.reset.description")}
          actionText={t("modals.reset.action")}
          onConfirm={resetFormToDefault}
        />
      </Stack>
    </Box>
  );
};
