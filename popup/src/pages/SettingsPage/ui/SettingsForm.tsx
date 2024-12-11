import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import {FormikProps, useField} from "formik";
import {ChangeEvent, FC} from "react";

import {Language, SettingsFormValues} from "../model/types/schema.ts";
import {SettingsFormSkeleton} from "@/pages/SettingsPage/ui/SettingsFormSkeleton.tsx";

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
    sourceLanguages,
    targetLanguages,
    loading
  } = props;

  const [targetLanguageCodeField, targetLanguageCodeMeta, targetLanguageCodeHelpers] = useField<string>("targetLanguageCode");
  const [sourceLanguageCodeField, sourceLanguageCodeMeta, sourceLanguageCodeHelpers] = useField<string>("sourceLanguageCode");
  const [autoPauseField, , autoPauseHelpers] = useField<boolean>("autoPause");

  const handleChangeTargetLanguage = (value: string) => {
    targetLanguageCodeHelpers.setValue(value);
    targetLanguageCodeHelpers.setError(undefined);
  };

  const handleChangeSourceLanguage = (value: string) => {
    sourceLanguageCodeHelpers.setValue(value);
    sourceLanguageCodeHelpers.setError(undefined);
  };

  const handleChangeAutoPause = (_: ChangeEvent<HTMLInputElement>,value: boolean) => {
    autoPauseHelpers.setValue(value);
    autoPauseHelpers.setError(undefined);
  };

  const getLanguageName = (code: string, locale: string = "en") => {
    const displayNames = new Intl.DisplayNames(locale, { type: "language" });
    return displayNames.of(code);
  };

  if (loading) {
    return <SettingsFormSkeleton/>;
  }

  return (
    <Box>
      <Stack spacing={2}>
        <FormControl fullWidth error={Boolean(targetLanguageCodeMeta.error && targetLanguageCodeMeta.touched)}>
          <InputLabel id="target-label">Target language</InputLabel>
          <Select
            labelId="target-label"
            id="target"
            label="Target language"
            value={targetLanguageCodeField.value}
            onChange={(event) => handleChangeTargetLanguage(event.target.value)}
            variant="outlined"
          >
            {targetLanguages.map((language) => (
              <MenuItem key={language.code} value={language.code}>{language.name || getLanguageName(language.code)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth error={Boolean(sourceLanguageCodeMeta.error && sourceLanguageCodeMeta.touched)}>
          <InputLabel id="source-label">Source language</InputLabel>
          <Select
            labelId="source-label"
            id="source"
            label="Source language"
            value={sourceLanguageCodeField.value}
            onChange={(event) => handleChangeSourceLanguage(event.target.value)}
            variant="outlined"
          >
            <MenuItem key="auto" value="auto">Auto</MenuItem>
            {sourceLanguages.map((language) => (
              <MenuItem key={language.code} value={language.code}>{language.name || getLanguageName(language.code)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Switch checked={autoPauseField.value} onChange={handleChangeAutoPause} name="gilad" />
            }
            label="Auto pause"
          />
          <FormHelperText>
            Automatically pause the video when hovering over subtitles
          </FormHelperText>
        </FormControl>
        {/*<FormControl fullWidth>*/}
        {/*  <FormControlLabel*/}
        {/*    control={*/}
        {/*      // fixme: change checked and onChange*/}
        {/*      <Switch checked={autoPauseField.value} onChange={handleChangeAutoPause} name="gilad" />*/}
        {/*    }*/}
        {/*    label="Use YouTube settings"*/}
        {/*  />*/}
        {/*  <FormHelperText>*/}
        {/*    Use the same appearance settings for translation tooltips as the subtitle settings on YouTube*/}
        {/*  </FormHelperText>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="font-family-label">Font family</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="font-family-label"*/}
        {/*    id="font-family"*/}
        {/*    label="Font family"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="font-color-label">Font color</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="font-color-label"*/}
        {/*    id="font-color"*/}
        {/*    label="Font color"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="font-size-label">Font size</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="font-size-label"*/}
        {/*    id="font-size"*/}
        {/*    label="Font size"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="background-color-label">Background color</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="background-color-label"*/}
        {/*    id="background-color"*/}
        {/*    label="Background color"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="background-opacity-label">Background opacity</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="background-opacity-label"*/}
        {/*    id="background-opacity"*/}
        {/*    label="Background opacity"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="character-edge-style-label">Character edge style</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="character-edge-style-label"*/}
        {/*    id="character-edge-style"*/}
        {/*    label="Character edge style"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
        {/*<FormControl fullWidth>*/}
        {/*  <InputLabel id="font-opacity-label">Font opacity</InputLabel>*/}
        {/*  <Select*/}
        {/*    labelId="font-opacity-label"*/}
        {/*    id="font-opacity"*/}
        {/*    label="Font opacity"*/}
        {/*    value={sourceLanguageCodeField.value}*/}
        {/*    onChange={(event) => handleChangeSourceLanguage(event.target.value)}*/}
        {/*    variant="outlined"*/}
        {/*  >*/}
        {/*    <MenuItem key="auto" value="auto">Auto</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}
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