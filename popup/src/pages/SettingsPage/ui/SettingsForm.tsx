import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import { FormikProps, useField } from "formik";
import { FC, useCallback, useMemo } from "react";

import { AvailableLanguages, Language, SettingsFormValues, Translator } from "../model/types/schema.ts";
import { SettingsFormSkeleton } from "./SettingsFormSkeleton.tsx";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { useTranslation } from "react-i18next";
import { InlineBanner } from "@/shared/ui/InlineBanner/InlineBanner.tsx";
import { MenuItemType } from "@/shared/types/types.ts";

const TRANSLATORS_OPTIONS: MenuItemType[]  = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
];

interface SettingsFormProps extends FormikProps<SettingsFormValues> {
  sourceLanguages: Language[];
  targetLanguages: Language[];
  fetchAvailableLanguages: (translator: Translator) => Promise<AvailableLanguages>;
  loading: boolean;
}

export const SettingsForm: FC<SettingsFormProps> = (props) => {
  const {
    handleSubmit,
    dirty,
    isValid,
    setFormikState,
    sourceLanguages,
    targetLanguages,
    fetchAvailableLanguages,
    loading,
  } = props;

  const { t } = useTranslation("settings");

  const [targetLanguageCodeField, targetLanguageCodeMeta, targetLanguageCodeHelpers] = useField<string>("targetLanguageCode");
  const [sourceLanguageCodeField, sourceLanguageCodeMeta, sourceLanguageCodeHelpers] = useField<string>("sourceLanguageCode");
  const [translatorField, translatorMeta, translatorHelpers] = useField<string>("translator");
  const [autoPauseField, , autoPauseHelpers] = useField<boolean>("autoPause");
  const [useDictionaryField, , useDictionaryHelpers] = useField<boolean>("useDictionary");
  const [alwaysMultipleSelectionField, , alwaysMultipleSelectionHelpers] = useField<boolean>("alwaysMultipleSelection");

  const handleChangeTargetLanguageCode = useCallback((value: string) => {
    targetLanguageCodeHelpers.setValue(value);
    targetLanguageCodeHelpers.setError(undefined);
  }, [targetLanguageCodeHelpers]);

  const handleChangeSourceLanguageCode = useCallback((value: string) => {
    sourceLanguageCodeHelpers.setValue(value);
    sourceLanguageCodeHelpers.setError(undefined);
  }, [sourceLanguageCodeHelpers]);

  const checkSelectedLanguages = useCallback((availableLanguages: AvailableLanguages) => {
    if (sourceLanguageCodeField.value !== "auto") {
      const sourceLanguagesCodes = availableLanguages.sourceLanguages.map((lang) => lang.code);

      if (!sourceLanguagesCodes.includes(sourceLanguageCodeField.value)) {
        sourceLanguageCodeHelpers.setValue("auto");
      }
    }

    const targetLanguagesCodes = availableLanguages.targetLanguages.map((lang) => lang.code);
    const userLanguage = chrome.i18n.getUILanguage();

    if (!targetLanguagesCodes.includes(targetLanguageCodeField.value)) {
      const newTargetLanguage = targetLanguagesCodes.includes(userLanguage) ? userLanguage : "en";
      targetLanguageCodeHelpers.setValue(newTargetLanguage);
    }
  }, [sourceLanguageCodeField.value, sourceLanguageCodeHelpers, targetLanguageCodeField.value, targetLanguageCodeHelpers]);

  const handleChangeTranslator = useCallback((value: string) => {
    translatorHelpers.setValue(value);
    fetchAvailableLanguages(value as Translator).then(checkSelectedLanguages);
    translatorHelpers.setError(undefined);
  }, [translatorHelpers, fetchAvailableLanguages, checkSelectedLanguages]);

  const handleChangeAutoPause = (value: boolean) => {
    autoPauseHelpers.setValue(value);
    autoPauseHelpers.setError(undefined);
  };

  const handleChangeUseDictionary = (value: boolean) => {
    useDictionaryHelpers.setValue(value);
    useDictionaryHelpers.setError(undefined);
  };

  const handleChangeAlwaysMultipleSelection = (value: boolean) => {
    alwaysMultipleSelectionHelpers.setValue(value);
    alwaysMultipleSelectionHelpers.setError(undefined);
  };

  const getLanguageName = (code: string, locale: string = "en") => {
    const displayNames = new Intl.DisplayNames(locale, { type: "language" });
    return displayNames.of(code);
  };

  const targetOptions = useMemo(() => {
    return targetLanguages.map((language) => ({
      value: language.code,
      label: language.name || getLanguageName(language.code) || "Unknown"
    }));
  }, [targetLanguages]);

  const sourceOptions = useMemo(() => {
    const result = sourceLanguages.map((language) => ({
      value: language.code,
      label: language.name || getLanguageName(language.code) || "Unknown"
    }));
    result.unshift({ value: "auto", label: "Auto" });
    return result;
  }, [sourceLanguages]);

  const resetFormToDefault = () => {
    const userLanguage = chrome.i18n.getUILanguage();
    const availableTargetLanguages = targetLanguages.map((lang) => lang.code);
    const isUserLanguageAvailable = availableTargetLanguages.includes(userLanguage);

    setFormikState((state) => {
      if (isUserLanguageAvailable) {
        return {
          ...state,
          values: {
            ...initialFormValues,
            targetLanguageCode: userLanguage
          }
        };
      }

      return {
        ...state,
        values: initialFormValues
      };
    });
    handleSubmit();
  };

  if (loading) {
    return <SettingsFormSkeleton/>;
  }

  return (
    <Box>
      <Stack spacing={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSubmit()}
          fullWidth
          disabled={!dirty || !isValid}
          title={dirty ? t("actions.save.tooltip") : t("actions.save.disabledTooltip")}
        >
          {t("actions.save.text")}
        </Button>
        <SettingsSelect
          id="targetLanguageCode"
          label={t("fields.targetLanguageCode.label")}
          tooltip={t("fields.targetLanguageCode.tooltip")}
          value={targetLanguageCodeField.value}
          error={Boolean(targetLanguageCodeMeta.error && targetLanguageCodeMeta.touched)}
          onChange={handleChangeTargetLanguageCode}
          options={targetOptions}
        />
        <SettingsSelect
          id="sourceLanguageCode"
          label={t("fields.sourceLanguageCode.label")}
          tooltip={t("fields.sourceLanguageCode.tooltip")}
          value={sourceLanguageCodeField.value}
          error={Boolean(sourceLanguageCodeMeta.error && sourceLanguageCodeMeta.touched)}
          onChange={handleChangeSourceLanguageCode}
          options={sourceOptions}
        />
        <SettingsSelect
          id="translator"
          label={t("fields.translator.label")}
          tooltip={t("fields.translator.tooltip")}
          value={translatorField.value}
          onChange={handleChangeTranslator}
          error={Boolean(translatorMeta.error && translatorMeta.touched)}
          options={TRANSLATORS_OPTIONS}
        />
        <InlineBanner message={t("tips.multipleSelection")} type="info"/>
        <FormControl fullWidth title={t("fields.autoPause.tooltip")}>
          <FormControlLabel
            control={
              <Switch
                checked={autoPauseField.value}
                onChange={(_, checked) => handleChangeAutoPause(checked)}
              />
            }
            label={t("fields.autoPause.label")}
          />
          <FormHelperText>
            {t("fields.autoPause.helperText")}
          </FormHelperText>
        </FormControl>
        <FormControl fullWidth title={t("fields.useDictionary.tooltip")}>
          <FormControlLabel
            control={
              <Switch
                checked={useDictionaryField.value}
                onChange={(_, checked) => handleChangeUseDictionary(checked)}
              />
            }
            label={t("fields.useDictionary.label")}
          />
          <FormHelperText>
            {t("fields.useDictionary.helperText")}
          </FormHelperText>
        </FormControl>
        <FormControl fullWidth title={t("fields.alwaysMultipleSelection.tooltip")}>
          <FormControlLabel
            control={
              <Switch
                checked={alwaysMultipleSelectionField.value}
                onChange={(_, checked) => handleChangeAlwaysMultipleSelection(checked)}
              />
            }
            label={t("fields.alwaysMultipleSelection.label")}
          />
          <FormHelperText>
            {t("fields.alwaysMultipleSelection.helperText")}
          </FormHelperText>
        </FormControl>
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
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSubmit()}
          fullWidth
          disabled={!dirty || !isValid}
          title={dirty ? t("actions.save.tooltip") : t("actions.save.disabledTooltip")}
        >
          {t("actions.save.text")}
        </Button>
      </Stack>
    </Box>
  );
};