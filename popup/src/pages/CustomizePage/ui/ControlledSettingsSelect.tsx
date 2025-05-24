import { FC } from "react";
import { Control, Controller } from "react-hook-form";
import { SettingsSelect } from "@/shared/ui/SettingsSelect/SettingsSelect.tsx";
import { CustomizeFormValues } from "../model/types/schema.ts";


interface ControlledSettingsSelectProps {
  name: Exclude<keyof CustomizeFormValues, "useYouTubeSettings">;
  control: Control<CustomizeFormValues>;
  label: string;
  tooltip: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onSubmit: (values: CustomizeFormValues) => Promise<void>;
  setValue: (name: keyof CustomizeFormValues, value: string, options?: { shouldDirty?: boolean }) => void;
  handleSubmit: (onSubmit: (values: CustomizeFormValues) => Promise<void>) => () => void;
}

export const ControlledSettingsSelect: FC<ControlledSettingsSelectProps> = ({
  name,
  control,
  label,
  tooltip,
  options,
  disabled,
  onSubmit,
  setValue,
  handleSubmit,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <SettingsSelect
        id={name}
        label={label}
        tooltip={tooltip}
        value={field.value}
        onChange={(value) => {
          setValue(name, value, { shouldDirty: true });
          handleSubmit(onSubmit)();
        }}
        options={options}
        disabled={disabled}
      />
    )}
  />
);
