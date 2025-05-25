import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import { FC, useCallback, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";

import { AvailableLanguages, Language, SettingsFormValues, Translator } from "../model/types/schema.ts";
import { SettingsFormSkeleton } from "./skeletons/SettingsFormSkeleton.tsx";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { useTranslation } from "react-i18next";
import { InlineBanner } from "@/shared/ui/InlineBanner/InlineBanner.tsx";
import { MenuItemType } from "@/shared/types/types.ts";
import { useNotification } from "@/app/providers/NotificationProvider";

const TRANSLATORS_OPTIONS: MenuItemType[]  = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
];

interface SettingsFormProps {
  initialValues: SettingsFormValues;
  onSubmit: (values: SettingsFormValues) => Promise<void>;
  sourceLanguages: Language[];
  targetLanguages: Language[];
  fetchAvailableLanguages: (translator: Translator) => Promise<AvailableLanguages>;
  loading: boolean;
}

export const SettingsForm: FC<SettingsFormProps> = ({
  initialValues,
  onSubmit,
  sourceLanguages,
  targetLanguages,
  fetchAvailableLanguages,
  loading,
}) => {
  const { t } = useTranslation("settings");
  const { control, handleSubmit, setValue, watch, reset } = useForm<SettingsFormValues>({
    defaultValues: initialValues,
  });

  const notification = useNotification();

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const getLanguageName = (code: string, locale: string = "en") => {
    const displayNames = new Intl.DisplayNames(locale, { type: "language" });
    return displayNames.of(code);
  };

  const sourceOptions = useMemo(() => {
    const result = sourceLanguages.map((language) => ({
      value: language.code,
      label: language.name || getLanguageName(language.code) || language.code
    }));
    result.unshift({ value: "auto", label: "Auto" });
    return result;
  }, [sourceLanguages]);

  const targetOptions = useMemo(() => {
    return targetLanguages.map((language) => ({
      value: language.code,
      label: language.name || getLanguageName(language.code) || language.code
    }));
  }, [targetLanguages]);

  const checkSelectedLanguages = useCallback((availableLanguages: AvailableLanguages) => {
    const watchSourceLanguageCode = watch("sourceLanguageCode");
    const watchTargetLanguageCode = watch("targetLanguageCode");
    const watchTranslator = watch("translator");

    const selectedSourceLanguage = sourceOptions.find(langOption => langOption.value === watchSourceLanguageCode);
    const selectedTargetLanguage = targetOptions.find(langOption => langOption.value === watchTargetLanguageCode);


    const selectedTranslatorLabel = TRANSLATORS_OPTIONS.find(option => option.value === watchTranslator)?.label || "Unknown";

    if (watchSourceLanguageCode !== "auto") {
      const sourceLanguagesCodes = availableLanguages.sourceLanguages.map((lang) => lang.code);
      if (!sourceLanguagesCodes.includes(watchSourceLanguageCode)) {
        setValue("sourceLanguageCode", "auto", { shouldDirty: true });

        const notificationMessage = `${selectedSourceLanguage?.label || "Unknown"} is not available as a source language for the ${selectedTranslatorLabel} translator. Switching to 'Auto'.`;
        notification.show(notificationMessage, { severity: "warning" });
      }
    }

    const targetLanguagesCodes = availableLanguages.targetLanguages.map((lang) => lang.code);
    const userLanguage = chrome.i18n.getUILanguage();

    if (!targetLanguagesCodes.includes(watchTargetLanguageCode)) {
      const newTargetLanguage = targetLanguagesCodes.includes(userLanguage) ? userLanguage : "en";
      setValue("targetLanguageCode", newTargetLanguage, { shouldDirty: true });

      const notificationMessage = `${selectedTargetLanguage?.label || "Unknown"} is not available as a target language for the ${selectedTranslatorLabel} translator. Switching to ${getLanguageName(newTargetLanguage)}.`;
      notification.show(notificationMessage, { severity: "warning" });
    }
  }, [notification, setValue, sourceOptions, targetOptions, watch]);

  const handleChangeSwitch = useCallback((field: keyof SettingsFormValues, value: boolean) => {
    setValue(field, value, { shouldDirty: true });
    handleSubmit(onSubmit)();
  }, [onSubmit, setValue, handleSubmit]);

  const resetFormToDefault = useCallback(() => {
    const userLanguage = chrome.i18n.getUILanguage();
    const availableTargetLanguages = targetLanguages.map((lang) => lang.code);
    const isUserLanguageAvailable = availableTargetLanguages.includes(userLanguage);

    const newValues = {
      ...initialFormValues,
      targetLanguageCode: isUserLanguageAvailable ? userLanguage : initialFormValues.targetLanguageCode
    };

    reset(newValues);
    onSubmit(newValues);
  }, [onSubmit, reset, targetLanguages]);

  if (loading) {
    return <SettingsFormSkeleton/>;
  }

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
              onChange={(value) => {
                setValue("translator", value as Translator, { shouldDirty: true });
                fetchAvailableLanguages(value as Translator).then(availableLanguages => {
                  checkSelectedLanguages(availableLanguages);
                  handleSubmit(onSubmit)();
                });
              }}
              options={TRANSLATORS_OPTIONS}
            />
          )}
        />
        <InlineBanner message={t("tips.multipleSelection")} type="info"/>
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
          name="useDictionary"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth title={t("fields.useDictionary.tooltip")}>
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(_, checked) => handleChangeSwitch("useDictionary", checked)}
                  />
                }
                label={t("fields.useDictionary.label")}
              />
              <FormHelperText>
                {t("fields.useDictionary.helperText")}
              </FormHelperText>
            </FormControl>
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