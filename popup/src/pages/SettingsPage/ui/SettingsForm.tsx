import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import { FormikProps, useField } from "formik";
import { FC, useMemo } from "react";

import { Language, SettingsFormValues } from "../model/types/schema.ts";
import { SettingsFormSkeleton } from "./SettingsFormSkeleton.tsx";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";

interface SettingsFormProps extends FormikProps<SettingsFormValues> {
  sourceLanguages: Language[];
  targetLanguages: Language[];
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
    loading,
  } = props;

  const [autoPauseField, , autoPauseHelpers] = useField<boolean>("autoPause");

  const handleChangeAutoPause = (value: boolean) => {
    autoPauseHelpers.setValue(value);
    autoPauseHelpers.setError(undefined);
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
        <SettingsSelect name="targetLanguageCode" label="Target language" options={targetOptions} />
        <SettingsSelect name="sourceLanguageCode" label="Source language" options={sourceOptions} />
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Switch
                checked={autoPauseField.value}
                onChange={(_, checked) => handleChangeAutoPause(checked)}
              />
            }
            label="Auto pause"
          />
          <FormHelperText>
            Automatically pause the video when hovering over subtitles
          </FormHelperText>
        </FormControl>
        <Button
          variant="outlined"
          color="error"
          onClick={() => resetFormToDefault()}
          fullWidth
        >
          Reset to default
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSubmit()}
          fullWidth
          disabled={!dirty || !isValid}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
};