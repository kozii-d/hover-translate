import { FC } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { OpenSettingsButton } from "./OpenSettingsButton.tsx";

/**
 * What DeepL does better and where to connect it. DeepL is connected in the
 * popup only, so the settings live in one place: the button opens the popup,
 * and the text says where for browsers that cannot.
 */
export const DeepLCard: FC = () => {
  const { t } = useTranslation(["welcome", "settings"]);

  return (
    <Alert severity="info" icon={<AutoAwesomeIcon/>} role="note">
      <Typography variant="body2">
        {t("settings:contextHint.text")} {t("settings:contextHint.keyNote")}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {t("welcome:deepl.where", { translatorField: t("settings:fields.translator.label") })}
      </Typography>
      <Box mt={1}>
        <OpenSettingsButton/>
      </Box>
    </Alert>
  );
};
