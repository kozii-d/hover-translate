import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import { FormikProps, useField } from "formik";
import { FC, useCallback, useMemo } from "react";

import { CustomizeFormValues } from "../model/types/schema.ts";
import { CustomizeFormSkeleton } from "./skeletons/CustomizeFormSkeleton.tsx";
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

  const { t } = useTranslation("customize");

  const [useYouTubeSettingsField, , useYouTubeSettingsHelpers] = useField<boolean>("useYouTubeSettings");
  
  const isDisabled = useYouTubeSettingsField.value;
  
  const [fontFamilyField, fontFamilyMeta, fontFamilyHelpers] = useField<string>("fontFamily");
  const [fontSizeField, fontSizeMeta, fontSizeHelpers] = useField<string>("fontSize");
  const [fontColorField, fontColorMeta, fontColorHelpers] = useField<string>("fontColor");
  const [fontOpacityField, fontOpacityMeta, fontOpacityHelpers] = useField<string>("fontOpacity");
  const [backgroundColorField, backgroundColorMeta, backgroundColorHelpers] = useField<string>("backgroundColor");
  const [backgroundOpacityField, backgroundOpacityMeta, backgroundOpacityHelpers] = useField<string>("backgroundOpacity");
  const [characterEdgeStyleField, characterEdgeStyleMeta, characterEdgeStyleHelpers] = useField<string>("characterEdgeStyle");

  const handleChangeFontFamily = useCallback((value: string) => {
    fontFamilyHelpers.setValue(value);
    fontFamilyHelpers.setError(undefined);
  }, [fontFamilyHelpers]);
  
  const handleChangeFontSize = useCallback((value: string) => {
    fontSizeHelpers.setValue(value);
    fontSizeHelpers.setError(undefined);
  }, [fontSizeHelpers]);
  
  const handleChangeFontColor = useCallback((value: string) => {
    fontColorHelpers.setValue(value);
    fontColorHelpers.setError(undefined);
  }, [fontColorHelpers]);
  
  const handleChangeFontOpacity = useCallback((value: string) => {
    fontOpacityHelpers.setValue(value);
    fontOpacityHelpers.setError(undefined);
  }, [fontOpacityHelpers]);
  
  const handleChangeBackgroundColor = useCallback((value: string) => {
    backgroundColorHelpers.setValue(value);
    backgroundColorHelpers.setError(undefined);
  }, [backgroundColorHelpers]);
  
  const handleChangeBackgroundOpacity = useCallback((value: string) => {
    backgroundOpacityHelpers.setValue(value);
    backgroundOpacityHelpers.setError(undefined);
  }, [backgroundOpacityHelpers]);
  
  const handleChangeCharacterEdgeStyle = useCallback((value: string) => {
    characterEdgeStyleHelpers.setValue(value);
    characterEdgeStyleHelpers.setError(undefined);
  }, [characterEdgeStyleHelpers]);



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
          id="fontFamily"
          label={t("fields.fontFamily.label")}
          tooltip={t("fields.fontFamily.tooltip")}
          value={fontFamilyField.value}
          onChange={handleChangeFontFamily}
          error={Boolean(fontFamilyMeta.error && fontFamilyMeta.touched)}
          options={FONT_FAMILY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="fontSize"
          label={t("fields.fontSize.label")}
          tooltip={t("fields.fontSize.tooltip")}
          value={fontSizeField.value}
          onChange={handleChangeFontSize}
          error={Boolean(fontSizeMeta.error && fontSizeMeta.touched)}
          options={FONT_SIZE_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="fontColor"
          label={t("fields.fontColor.label")}
          tooltip={t("fields.fontColor.tooltip")}
          value={fontColorField.value}
          onChange={handleChangeFontColor}
          error={Boolean(fontColorMeta.error && fontColorMeta.touched)}
          options={FONT_COLOR_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="fontOpacity"
          label={t("fields.fontOpacity.label")}
          tooltip={t("fields.fontOpacity.tooltip")}
          value={fontOpacityField.value}
          onChange={handleChangeFontOpacity}
          error={Boolean(fontOpacityMeta.error && fontOpacityMeta.touched)}
          options={FONT_OPACITY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="backgroundColor"
          label={t("fields.backgroundColor.label")}
          tooltip={t("fields.backgroundColor.tooltip")}
          value={backgroundColorField.value}
          onChange={handleChangeBackgroundColor}
          error={Boolean(backgroundColorMeta.error && backgroundColorMeta.touched)}
          options={BACKGROUND_COLOR_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="backgroundOpacity"
          label={t("fields.backgroundOpacity.label")}
          tooltip={t("fields.backgroundOpacity.tooltip")}
          value={backgroundOpacityField.value}
          onChange={handleChangeBackgroundOpacity}
          error={Boolean(backgroundOpacityMeta.error && backgroundOpacityMeta.touched)}
          options={BACKGROUND_OPACITY_ITEMS}
          disabled={isDisabled}
        />
        <SettingsSelect
          id="characterEdgeStyle"
          label={t("fields.characterEdgeStyle.label")}
          tooltip={t("fields.characterEdgeStyle.tooltip")}
          value={characterEdgeStyleField.value}
          onChange={handleChangeCharacterEdgeStyle}
          error={Boolean(characterEdgeStyleMeta.error && characterEdgeStyleMeta.touched)}
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