import { FC } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import SaveIcon from "@mui/icons-material/Save";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";

export const Tips: FC = () => {
  const { t } = useTranslation("about");

  return (
    <Box>
      <Typography variant="h6" gutterBottom textTransform="uppercase" fontWeight="bold">
        {t("blocks.tips.title")}
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <SelectAllIcon />
              <Typography variant="body1" color="text.secondary">{t("blocks.tips.multipleSelection")}</Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <SaveIcon />
              <Typography variant="body1" color="text.secondary">{t("blocks.tips.saveToDictionary")}</Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <FileDownloadIcon />
              <Typography variant="body1" color="text.secondary">{t("blocks.tips.exportDictionary")}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};