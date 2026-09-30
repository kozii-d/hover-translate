import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { FC, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { toTag } from "@/shared/lib/helpers/languageNames.ts";
import { MenuItemType } from "@/shared/types/types.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { CustomizeFormValues } from "../model/types/schema.ts";
import {
  BACKGROUND_OPACITIES,
  CHARACTER_EDGE_STYLES,
  COLORS,
  FONT_FAMILIES,
  FONT_OPACITIES,
  FONT_SIZES
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
  const { t, i18n } = useTranslation("customize");
  const { control, handleSubmit, setValue, watch, reset } = useForm<CustomizeFormValues>({
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const isDisabled = watch("useYouTubeSettings");

  // The items are named as YouTube's own caption options name them in the
  // popup's language, and the percentages written as YouTube writes them,
  // by `Intl` ("50 %" in Russian, "%50" in Turkish).
  const options = useMemo(() => {
    const percent = new Intl.NumberFormat(toTag(i18n.language), { style: "percent" });
    const menu = (items: MenuItemType[]) => [{ value: "auto", label: t("options.auto") }, ...items];
    const named = (group: string, values: string[]) =>
      menu(values.map((value) => ({ value, label: t(`options.${group}.${value}`) })));
    const percentages = (values: string[]) =>
      menu(values.map((value) => ({ value, label: percent.format(parseFloat(value) / 100) })));

    return {
      fontFamily: named("fontFamily", FONT_FAMILIES),
      color: named("color", COLORS),
      characterEdgeStyle: named("characterEdgeStyle", CHARACTER_EDGE_STYLES),
      fontSize: percentages(FONT_SIZES),
      fontOpacity: percentages(FONT_OPACITIES),
      backgroundOpacity: percentages(BACKGROUND_OPACITIES),
    };
  }, [t, i18n.language]);

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
          options={options.fontFamily}
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
          options={options.fontSize}
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
          options={options.color}
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
          options={options.fontOpacity}
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
          options={options.color}
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
          options={options.backgroundOpacity}
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
          options={options.characterEdgeStyle}
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