import { FC } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

interface YouTubeAccessAlertProps {
  onAllow: () => void;
}

/**
 * Shown for as long as the extension has no access to YouTube, so it cannot
 * be closed. The browser does not inject the content script into tabs that
 * are already open, hence the reload in the text.
 */
export const YouTubeAccessAlert: FC<YouTubeAccessAlertProps> = ({ onAllow }) => {
  const { t } = useTranslation("settings");

  return (
    <Alert severity="warning">
      {t("youtubeAccess.text")}
      <Box mt={1}>
        <Button size="small" variant="outlined" color="warning" onClick={onAllow}>
          {t("youtubeAccess.allow")}
        </Button>
      </Box>
    </Alert>
  );
};
