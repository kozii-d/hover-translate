import { FC } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export const EmptyState: FC = () => {
  const { t } = useTranslation(["dictionary"]);
  
  return (
    <Box alignSelf="center" paddingY={4}>
      <Typography variant="h5" align="center">
        {t("emptyState.title")}
      </Typography>
      <Typography marginTop={2} variant="body1" align="center">
        {t("emptyState.description")}
      </Typography>
    </Box>
  );
};