import { FC, memo } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import { MenuItemType } from "../../types/types.ts";

interface SettingsSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  label: string;
  tooltip?: string;
  options: MenuItemType[];
  disabled?: boolean;
}

export const SettingsSelect: FC<SettingsSelectProps> = memo((props) => {
  const { id, value, onChange, error, options, label, tooltip, disabled } =
    props;

  const renderMenuItem = (item: MenuItemType) => (
    <MenuItem key={item.value} value={item.value}>
      {item.description
        ? <ListItemText primary={item.label} secondary={item.description} sx={{ my: 0 }} />
        : item.label}
    </MenuItem>
  );

  // The closed select shows the label alone, not the menu's second line.
  const renderValue = (selected: string) =>
    options.find((option) => option.value === selected)?.label ?? selected;

  return (
    <FormControl fullWidth error={error} title={tooltip || label}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        renderValue={renderValue}
        variant="outlined"
        disabled={disabled}
      >
        {options.map(renderMenuItem)}
      </Select>
    </FormControl>
  );
});
