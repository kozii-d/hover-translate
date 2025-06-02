import { FC } from "react";
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
  const reviewUrl = `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom textTransform="uppercase" fontWeight="bold">
        {t("blocks.support.title")}
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button
          startIcon={<StarIcon/>}
          variant="contained"
          component="a"
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
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