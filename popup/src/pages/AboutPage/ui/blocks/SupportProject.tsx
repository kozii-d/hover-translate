import { FC, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import StarIcon from "@mui/icons-material/Star";
import CoffeeIcon from "@mui/icons-material/Coffee";
import { useTranslation } from "react-i18next";

interface SupportProjectProps {
  openModal: () => void;
}

export const SupportProject: FC<SupportProjectProps> = (props) => {
  const { openModal } = props;
  const { t } = useTranslation("about");
  
  const browser = useMemo(() => {
    if (typeof chrome !== "undefined") {
      const url = chrome.runtime.getURL("");
      if (url.startsWith("moz-extension://")) {
        return "firefox";
      } else if (url.startsWith("chrome-extension://")) {
        if (navigator.userAgent.includes("Edg/")) {
          return "edge";
        }
        return "chrome";
      }
    }

    return "unknown";
  }, []);
  
  const reviewUrl = useMemo(() => {
    switch (browser) {
    case "chrome":
      return `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
    case "firefox":
      return "https://addons.mozilla.org/en-US/firefox/addon/hovertranslate/reviews";
    case "edge":
      return `https://microsoftedge.microsoft.com/addons/detail/${chrome.runtime.id}`;
    default:
      return null;
    }
  }, [browser]);

  const openReviewPage = () => {
    if (!reviewUrl) {
      console.error("Unsupported browser or review URL not available.");
      return;
    }

    chrome.tabs.create({
      url: reviewUrl,
    });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom textTransform="uppercase" fontWeight="bold">
        {t("blocks.support.title")}
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button
          startIcon={<StarIcon/>}
          variant="contained"
          onClick={openReviewPage}
          disabled={!reviewUrl}
        >
          {t("blocks.support.actions.review.text")}
        </Button>
        <Button
          startIcon={<CoffeeIcon/>}
          onClick={openModal}
          variant="outlined"
        >
          {t("blocks.support.actions.donate.text")}
        </Button>
      </Stack>
    </Box>
  );
};