import { FC } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import StarIcon from "@mui/icons-material/Star";
import CoffeeIcon from "@mui/icons-material/Coffee";
import { useTranslation } from "react-i18next";

export const SupportProject: FC = () => {
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
          {t("blocks.support.actions.review")}
        </Button>
        <Button
          startIcon={<CoffeeIcon/>}
          variant="outlined"
          component="a"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          disabled
        >
          {t("blocks.support.actions.donate")}
        </Button>
      </Stack>
    </Box>
  );
};