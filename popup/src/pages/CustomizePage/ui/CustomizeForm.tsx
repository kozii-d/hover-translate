import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import { FormikProps, useField } from "formik";
import { FC, useMemo } from "react";

import { CustomizeFormValues } from "../model/types/schema.ts";
import { CustomizeFormSkeleton } from "./CustomizeFormSkeleton.tsx";
import {
  BACKGROUND_COLOR_ITEMS,
  BACKGROUND_OPACITY_ITEMS,
  CHARACTER_EDGE_STYLE_ITEMS,
  FONT_COLOR_ITEMS,
  FONT_FAMILY_ITEMS,
  FONT_OPACITY_ITEMS,
  FONT_SIZE_ITEMS
} from "../model/consts/menuItems.ts";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";

interface CustomizeFormProps extends FormikProps<CustomizeFormValues> {
  loading: boolean;
}

export const CustomizeForm: FC<CustomizeFormProps> = (props) => {
  const {
    handleSubmit,
    dirty,
    isValid,
    loading,
    setFormikState
  } = props;

  const [useYouTubeSettingsField, , useYouTubeSettingsHelpers] = useField<boolean>("useYouTubeSettings");

  const isDisabled = useYouTubeSettingsField.value;
 
  const handleChangeUseYouTubeSettings = (value: boolean) => {
    useYouTubeSettingsHelpers.setValue(value);
    useYouTubeSettingsHelpers.setError(undefined);
  };

  const saveButton = useMemo(() => {
    return (
      <Button
        variant="contained"
        color="primary"
        onClick={() => handleSubmit()}
        fullWidth
        disabled={!dirty || !isValid}
      >
        Save
      </Button>
    );
  }, [dirty, handleSubmit, isValid]);

  const resetFormToDefault = () => {
    setFormikState((state) => {
      return {
        ...state,
        values: initialFormValues
      };
    });
    handleSubmit();
  };

  if (loading) {
    return <CustomizeFormSkeleton/>;
  }

  return (
    <Box>
      <Stack spacing={2}>
        {saveButton}
        <FormControl fullWidth>
          <FormControlLabel
            control={
              <Switch
                checked={useYouTubeSettingsField.value}
                onChange={(_, checked) => handleChangeUseYouTubeSettings(checked)}
              />
            }
            label="Use YouTube settings"
          />
          <FormHelperText>
            Use the same appearance settings for translation tooltips as the subtitle settings on YouTube
          </FormHelperText>
        </FormControl>
        <SettingsSelect name="fontFamily" label="Font family" options={FONT_FAMILY_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="fontSize" label="Font size" options={FONT_SIZE_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="fontColor" label="Font color" options={FONT_COLOR_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="fontOpacity" label="Font opacity" options={FONT_OPACITY_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="backgroundColor" label="Background color" options={BACKGROUND_COLOR_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="backgroundOpacity" label="Background opacity" options={BACKGROUND_OPACITY_ITEMS} disabled={isDisabled} />
        <SettingsSelect name="characterEdgeStyle" label="Character edge style" options={CHARACTER_EDGE_STYLE_ITEMS} disabled={isDisabled} />
        <Button
          variant="outlined"
          color="error"
          onClick={() => resetFormToDefault()}
          fullWidth
        >
          Reset to default
        </Button>
        {saveButton}
      </Stack>
    </Box>
  );
};