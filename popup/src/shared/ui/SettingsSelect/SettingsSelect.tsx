import { FC, memo } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import { MenuItemType } from "../../types/types.ts";
import { OptionLabel } from "../OptionLabel/OptionLabel.tsx";

interface SettingsSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  label: string;
  tooltip?: string;
  options: MenuItemType[];
  disabled?: boolean;
  /** Called instead of opening the menu, which then never opens: the field opens something else. */
  onOpen?: () => void;
}

export const SettingsSelect: FC<SettingsSelectProps> = memo((props) => {
  const { id, value, onChange, error, options, label, tooltip, disabled, onOpen } =
    props;

  const renderMenuItem = (item: MenuItemType) => (
    <MenuItem key={item.value} value={item.value}>
      {item.description
        ? <ListItemText primary={<OptionLabel item={item}/>} secondary={item.description} sx={{ my: 0 }} />
        : <OptionLabel item={item}/>}
    </MenuItem>
  );

  // The closed select shows the label and its icon, not the menu's second line.
  const renderValue = (selected: string) => {
    const option = options.find((item) => item.value === selected);
    return option ? <OptionLabel item={option}/> : selected;
  };

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
        open={onOpen ? false : undefined}
        onOpen={onOpen}
      >
        {options.map(renderMenuItem)}
      </Select>
    </FormControl>
  );
});
