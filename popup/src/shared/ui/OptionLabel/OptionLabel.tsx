import { FC } from "react";
import Box from "@mui/material/Box";
import { MenuItemType } from "../../types/types.ts";

/** An item's label and, after it, its icon: the same in a list and in the closed field. */
export const OptionLabel: FC<{ item: MenuItemType }> = ({ item }) => item.icon
  ? <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1 }}>{item.label}{item.icon}</Box>
  : item.label;
