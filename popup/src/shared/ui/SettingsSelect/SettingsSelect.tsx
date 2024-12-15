import { FC } from "react";
import { useField } from "formik";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { MenuItemType } from "../../types/types.ts";

interface SettingsSelectProps {
  name: string;
  label: string;
  options: MenuItemType[];
  disabled?: boolean;
}

export const SettingsSelect: FC<SettingsSelectProps> = (props) => {
  const { name, options, label, disabled } = props;
  const [field, meta, helpers] = useField<string>(name);

  const handleChange = (value: string) => {
    helpers.setValue(value);
    helpers.setError(undefined);
  };

  const renderMenuItem = (item: MenuItemType) => (
    <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
  );
  
  return (
    <FormControl fullWidth error={Boolean(meta.error && meta.touched)}>
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select
        labelId="font-family-label"
        id={name}
        label={label}
        value={field.value}
        onChange={(event) => handleChange(event.target.value)}
        variant="outlined"
        disabled={disabled}
      >
        {options.map(renderMenuItem)}
      </Select>
    </FormControl>
  );
};