import { FC } from "react";
import IconButton from "@mui/material/IconButton";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/shared/lib/theme/popupTheme.ts";

export const ThemeToggle: FC = () => {
  const { t } = useTranslation("common");
  const { mode, toggleMode } = useThemeMode();

  // The icon and the title name the theme a click switches to.
  const title = mode === "dark" ? t("tooltips.switchToLightTheme") : t("tooltips.switchToDarkTheme");

  return (
    <IconButton onClick={toggleMode} title={title} aria-label={title}>
      {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
    </IconButton>
  );
};
