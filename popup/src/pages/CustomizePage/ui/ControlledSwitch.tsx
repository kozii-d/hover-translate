import { FC } from "react";
import { Control, Controller } from "react-hook-form";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import FormHelperText from "@mui/material/FormHelperText";
import { CustomizeFormValues } from "../model/types/schema.ts";

interface ControlledSwitchProps {
  name: keyof Pick<CustomizeFormValues, "useYouTubeSettings">;
  control: Control<CustomizeFormValues>;
  label: string;
  tooltip: string;
  helperText: string;
  onSubmit: (values: CustomizeFormValues) => Promise<void>;
  setValue: (name: keyof CustomizeFormValues, value: boolean, options?: { shouldDirty?: boolean }) => void;
  handleSubmit: (onSubmit: (values: CustomizeFormValues) => Promise<void>) => () => void;
}

export const ControlledSwitch: FC<ControlledSwitchProps> = ({
  name,
  control,
  label,
  tooltip,
  helperText,
  onSubmit,
  setValue,
  handleSubmit,
}) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <FormControl fullWidth title={tooltip}>
        <FormControlLabel
          control={
            <Switch
              checked={field.value}
              onChange={(_, checked) => {
                setValue(name, checked, { shouldDirty: true });
                handleSubmit(onSubmit)();
              }}
            />
          }
          label={label}
        />
        <FormHelperText>
          {helperText}
        </FormHelperText>
      </FormControl>
    )}
  />
);
