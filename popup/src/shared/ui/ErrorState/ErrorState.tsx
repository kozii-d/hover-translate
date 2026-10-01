import { FC } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  onRetry: () => void;
}

/**
 * In place of a page whose data could not be read or that failed to draw. One
 * text for every case: what went wrong goes to the console. No way to reset
 * from here — after a failed read nobody knows what is stored, and a reset of
 * `sync` would overwrite the settings on every device.
 */
export const ErrorState: FC<ErrorStateProps> = ({ onRetry }) => {
  const { t } = useTranslation("common");

  return (
    <Stack alignItems="center" spacing={2} paddingY={4} textAlign="center">
      <Typography variant="h5">{t("errorState.title")}</Typography>
      <Typography color="text.secondary">{t("errorState.hint")}</Typography>
      <Button variant="contained" onClick={onRetry}>{t("errorState.retry")}</Button>
    </Stack>
  );
};
