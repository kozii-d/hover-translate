import { FC, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import CoffeeIcon from "@mui/icons-material/Coffee";
import Alert from "@mui/material/Alert";
import { CryptoCard } from "./CryptoCard.tsx";
import { CRYPTO_DATA } from "../model/const/cryptoData.ts";
import { useTranslation } from "react-i18next";

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export const SupportModal: FC<SupportModalProps> = (props) => {
  const { open, onClose } = props;
  const [expandedQR, setExpandedQR] = useState<string | null>(null);
  const { t } = useTranslation("modals");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="support-dialog-title"
      fullWidth
    >
      <DialogTitle
        id="support-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <CoffeeIcon fontSize="large" />
          <Typography variant="h5">
            {t("support.title")}
          </Typography>
        </Stack>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: "text.secondary" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ whiteSpace: "pre-line" }}
          >
            {t("support.description")}
          </Typography>
          <Alert severity="warning">
            {t("support.warnings.verifyNetwork")}
          </Alert>
          {CRYPTO_DATA.map((crypto) => (
            <CryptoCard
              key={crypto.id}
              data={crypto}
              expandedQR={expandedQR}
              setExpandedQR={setExpandedQR}
            />
          ))}
        </Stack>
      </DialogContent>
      <Typography
        variant="body2"
        color="text.secondary"
        align="center"
        marginBlock={2}
      >
        {t("support.footer")}{" "}
        <span style={{ color: "red" }}>❤️</span>
      </Typography>
    </Dialog>
  );
};