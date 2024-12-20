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
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { useTranslation } from "react-i18next";

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

  const { t } = useTranslation("customization");

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
        title={dirty ? t("actions.save.tooltip") : t("actions.save.disabledTooltip")}
      >
        {t("actions.save.text")}
      </Button>
    );
  }, [dirty, handleSubmit, isValid, t]);

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
        <FormControl fullWidth title={t("fields.useYouTubeSettings.tooltip")}>
          <FormControlLabel
            control={
              <Switch
                checked={useYouTubeSettingsField.value}
                onChange={(_, checked) => handleChangeUseYouTubeSettings(checked)}
              />
            }
            label={t("fields.useYouTubeSettings.label")}
          />
          <FormHelperText>
            {t("fields.useYouTubeSettings.helperText")}
          </FormHelperText>
        </FormControl>
        <SettingsSelect
          name="fontFamily"
          label={t("fields.fontFamily.label")}
          tooltip={t("fields.fontFamily.tooltip")}
          options={FONT_FAMILY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="fontSize"
          label={t("fields.fontSize.label")}
          tooltip={t("fields.fontSize.tooltip")}
          options={FONT_SIZE_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="fontColor"
          label={t("fields.fontColor.label")}
          tooltip={t("fields.fontColor.tooltip")}
          options={FONT_COLOR_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="fontOpacity"
          label={t("fields.fontOpacity.label")}
          tooltip={t("fields.fontOpacity.tooltip")}
          options={FONT_OPACITY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="backgroundColor"
          label={t("fields.backgroundColor.label")}
          tooltip={t("fields.backgroundColor.tooltip")}
          options={BACKGROUND_COLOR_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="backgroundOpacity"
          label={t("fields.backgroundOpacity.label")}
          tooltip={t("fields.backgroundOpacity.tooltip")}
          options={BACKGROUND_OPACITY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          name="characterEdgeStyle"
          label={t("fields.characterEdgeStyle.label")}
          tooltip={t("fields.characterEdgeStyle.tooltip")}
          options={CHARACTER_EDGE_STYLE_ITEMS}
          disabled={isDisabled}
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
        {saveButton}
      </Stack>
    </Box>
  );
};