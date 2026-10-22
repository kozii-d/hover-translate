import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import { OpenSettingsButton } from "./OpenSettingsButton.tsx";

const TITLE_ID = "welcome-popup-tabs";

/** What the popup's tabs hold, each named as its tab is (`tabLabel`). */
export const PopupTabsCard: FC = () => {
  const { t } = useTranslation(["welcome", "settings", "customize", "dictionary"]);

  const items: { icon: ReactNode; ns: string; text: string }[] = [
    { icon: <SettingsOutlinedIcon/>, ns: "settings", text: t("welcome:more.settings") },
    { icon: <PaletteOutlinedIcon/>, ns: "customize", text: t("welcome:more.customize") },
    { icon: <MenuBookOutlinedIcon/>, ns: "dictionary", text: t("welcome:more.dictionary") },
  ];

  return (
    <Paper component="section" variant="outlined" aria-labelledby={TITLE_ID} sx={{ p: 2 }}>
      {/* `useFlexGap`: the spacing's margins would take the button's own. */}
      <Stack spacing={1.5} useFlexGap>
        <Typography id={TITLE_ID} variant="h6" component="h2">{t("welcome:more.title")}</Typography>
        {items.map(({ icon, ns, text }) => (
          <Stack key={ns} direction="row" spacing={1.5} alignItems="flex-start">
            <Stack sx={{ color: "text.secondary", pt: 0.25 }} aria-hidden>{icon}</Stack>
            <div>
              <Typography fontWeight={600}>{t(`${ns}:tabLabel`)}</Typography>
              <Typography variant="body2" color="text.secondary">{text}</Typography>
            </div>
          </Stack>
        ))}
        {/* Under the text of the lines, past their icons' column (24 px and the gap). */}
        <OpenSettingsButton color="primary" sx={{ ml: 4.5 }}/>
      </Stack>
    </Paper>
  );
};
