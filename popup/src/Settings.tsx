import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import {FormikProps, useField} from "formik";
import {useEffect, useState} from "react";
import axios from "axios";
import {SettingsSkeleton} from "./SettingsSkeleton.tsx";
import {SettingsFormValues} from "./App.tsx";

export interface Language {
  code: string;
  name: string;
}

interface LanguageResponse {
  targetLanguages: Language[];
  sourceLanguages: Language[];
}


export const Settings = (props: FormikProps<SettingsFormValues>) => {
  const { handleSubmit, dirty } = props;

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [targetLanguageCodeField, , targetLanguageCodeHelpers] = useField<string>("targetLanguageCode");
  const [sourceLanguageCodeField, , sourceLanguageCodeHelpers] = useField<string>("sourceLanguageCode");

  const handleChangeTargetLanguage = (value: string) => {
    targetLanguageCodeHelpers.setValue(value);
    targetLanguageCodeHelpers.setError(undefined);
  };

  const handleChangeSourceLanguage = (value: string) => {
    sourceLanguageCodeHelpers.setValue(value);
    sourceLanguageCodeHelpers.setError(undefined);
  };

  useEffect(() => {
    const fetchLanguagesData = async () => {
      setLoading(true);
      try {
        const response = await axios.get<LanguageResponse>(`${__API_URL__}/translation/languages`);
        setSourceLanguages(response.data.sourceLanguages);
        setTargetLanguages(response.data.targetLanguages);
      } catch (error) {
        console.error("Failed to fetch source languages", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLanguagesData();
  }, []);

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>
      <Stack spacing={2}>
        <FormControl fullWidth>
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
              <MenuItem key={language.code} value={language.code}>{language.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
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
              <MenuItem key={language.code} value={language.code}>{language.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSubmit()}
          fullWidth
          disabled={!dirty}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
};