import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";

/**
 * Opens the popup as the toolbar icon does (`action.openPopup`, Chrome 118+,
 * without a policy from 127; Firefox 109+ from a click). Not shown where the
 * browser has no such function, and gone once it refuses: the text around it
 * says where the settings are.
 */
export const OpenSettingsButton: FC = () => {
  const { t } = useTranslation("welcome");
  const [canOpenPopup, setCanOpenPopup] = useState(() => typeof chrome.action?.openPopup === "function");

  // Straight from the click: Firefox opens it only during a user gesture.
  const openPopup = () => {
    chrome.action.openPopup().catch((error) => {
      console.warn("Could not open the popup", error);
      setCanOpenPopup(false);
    });
  };

  if (!canOpenPopup) return null;

  return (
    <Button size="small" variant="outlined" color="info" onClick={openPopup} sx={{ alignSelf: "flex-start" }}>
      {t("openSettings")}
    </Button>
  );
};
