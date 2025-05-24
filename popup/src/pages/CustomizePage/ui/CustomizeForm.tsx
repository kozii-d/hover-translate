import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { FC, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { CustomizeFormValues } from "../model/types/schema.ts";
import {
  BACKGROUND_COLOR_ITEMS,
  BACKGROUND_OPACITY_ITEMS,
  CHARACTER_EDGE_STYLE_ITEMS,
  FONT_COLOR_ITEMS,
  FONT_FAMILY_ITEMS,
  FONT_OPACITY_ITEMS,
  FONT_SIZE_ITEMS
} from "../model/consts/menuItems.ts";
import { CustomizeFormSkeleton } from "./skeletons/CustomizeFormSkeleton.tsx";
import { ControlledSwitch } from "./ControlledSwitch.tsx";
import { ControlledSettingsSelect } from "./ControlledSettingsSelect.tsx";

interface CustomizeFormProps {
  initialValues: CustomizeFormValues;
  onSubmit: (values: CustomizeFormValues) => Promise<void>;
  loading: boolean;
}

export const CustomizeForm: FC<CustomizeFormProps> = ({
  initialValues,
  onSubmit,
  loading,
}) => {
  const { t } = useTranslation("customize");
  const { control, handleSubmit, setValue, watch, reset } = useForm<CustomizeFormValues>({
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const isDisabled = watch("useYouTubeSettings");

  const resetFormToDefault = useCallback(() => {
    reset(initialFormValues);
    handleSubmit(onSubmit)();
  }, [onSubmit, reset, handleSubmit]);

  if (loading) {
    return <CustomizeFormSkeleton/>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <ControlledSwitch
          name="useYouTubeSettings"
          control={control}
          label={t("fields.useYouTubeSettings.label")}
          tooltip={t("fields.useYouTubeSettings.tooltip")}
          helperText={t("fields.useYouTubeSettings.helperText")}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="fontFamily"
          control={control}
          label={t("fields.fontFamily.label")}
          tooltip={t("fields.fontFamily.tooltip")}
          options={FONT_FAMILY_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="fontSize"
          control={control}
          label={t("fields.fontSize.label")}
          tooltip={t("fields.fontSize.tooltip")}
          options={FONT_SIZE_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="fontColor"
          control={control}
          label={t("fields.fontColor.label")}
          tooltip={t("fields.fontColor.tooltip")}
          options={FONT_COLOR_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="fontOpacity"
          control={control}
          label={t("fields.fontOpacity.label")}
          tooltip={t("fields.fontOpacity.tooltip")}
          options={FONT_OPACITY_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="backgroundColor"
          control={control}
          label={t("fields.backgroundColor.label")}
          tooltip={t("fields.backgroundColor.tooltip")}
          options={BACKGROUND_COLOR_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="backgroundOpacity"
          control={control}
          label={t("fields.backgroundOpacity.label")}
          tooltip={t("fields.backgroundOpacity.tooltip")}
          options={BACKGROUND_OPACITY_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
        />
        <ControlledSettingsSelect
          name="characterEdgeStyle"
          control={control}
          label={t("fields.characterEdgeStyle.label")}
          tooltip={t("fields.characterEdgeStyle.tooltip")}
          options={CHARACTER_EDGE_STYLE_ITEMS}
          disabled={isDisabled}
          onSubmit={onSubmit}
          setValue={setValue}
          handleSubmit={handleSubmit}
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