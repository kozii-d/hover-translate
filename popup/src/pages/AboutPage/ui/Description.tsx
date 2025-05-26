import { FC } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export const Description: FC = () => {
  const { t } = useTranslation("about");

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        {t("blocks.description.title")}
      </Typography>
      <Typography variant="subtitle1" color={"text.secondary"}>
        {t("blocks.description.subtitle")}
      </Typography>
      <Typography variant="subtitle1" color={"text.secondary"}>
        {t("blocks.description.thank-you")}
      </Typography>
    </Box>
  );
};