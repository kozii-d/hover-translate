import { FC, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import StarIcon from "@mui/icons-material/Star";
import CoffeeIcon from "@mui/icons-material/Coffee";
import { useTranslation } from "react-i18next";
import { RATING_PROMPT_DONE_KEY, getReviewPageUrl } from "@extension/common/ratingPrompt.ts";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";

interface SupportProjectProps {
  openModal: () => void;
}

export const SupportProject: FC<SupportProjectProps> = (props) => {
  const { openModal } = props;
  const { t } = useTranslation("about");
  const { set } = useStorage();
  
  // Null in an unpacked build: its id belongs to no store.
  const reviewUrl = useMemo(() => getReviewPageUrl(chrome.runtime.getURL(""), chrome.runtime.id), []);

  const openReviewPage = async () => {
    if (!reviewUrl) return;

    // Whoever rates from here is not asked again by the rating cards. Written
    // first: the browser closes the popup as soon as the tab opens.
    await set(RATING_PROMPT_DONE_KEY, true, "sync")
      .catch((error) => console.error("Could not remember that the rating request is done", error));

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