import { FC, useEffect, useState } from "react";
import type { CryptoData } from "../types/cryptoData.ts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { Alert, Chip, Typography } from "@mui/material";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from  "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import QrCodeIcon from "@mui/icons-material/QrCode2";
import QRCode from "qrcode";
import { useNotifications } from "@toolpad/core/useNotifications";
import { useTranslation } from "react-i18next";

interface CryptoCardProps {
  data: CryptoData;
  expandedQR: string | null;
  setExpandedQR: (value: string | null) => void;
}

export const CryptoCard: FC<CryptoCardProps> = (props) => {
  const {
    data,
    expandedQR,
    setExpandedQR,
  } = props;
  const { id, networkName, networkType, tokens, address, warningKey, Icon } = data;

  const { t } = useTranslation("modals");
  const notifications = useNotifications();

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string>("");

  const isExpanded = expandedQR === id;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      notifications.show(t("support.notifications.copyAddress"), { severity: "success", autoHideDuration: 2000 });
    } catch (error) {
      const errorMessage = "Failed to copy address";
      setIsCopied(false);
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    }
  };
  
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const svgString = await QRCode.toString(address, {
          type: "svg",
          width: 200,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff"
          },
          errorCorrectionLevel: "H"
        });
        setQrCodeSvg(svgString);
      } catch (error) {
        const errorMessage = "Failed to generate QR code";
        notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
        console.error(errorMessage, error);
      }
    };

    if (isExpanded && address && !qrCodeSvg) {
      generateQRCode();
    }
  }, [isExpanded, address, qrCodeSvg, notifications]);


  return (
    <Card>
      <Box p={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Icon width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={500}>
              {networkName}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {tokens.map((token) => (
                <Chip
                  key={token}
                  label={token}
                  size="small"
                  sx={{
                    fontSize: "0.7rem"
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Divider />
      <CardContent>
        <Box mb={1}>
          <Typography
            variant="caption"
            color="text.secondary"
            textTransform="uppercase"
          >
            {networkType} {t("support.labels.address")}
          </Typography>
        </Box>
        <Box mb={warningKey ? 1 : 2}>
          <Card variant="outlined" sx={{ wordBreak: "break-all" }}>
            <Typography
              padding={1}
              variant="body2"
              color="text.secondary"
              fontFamily="monospace"
            >
              {address}
            </Typography>
          </Card>
        </Box>
        {warningKey && (
          <Box mb={2}>
            <Alert severity="info">
              {t(warningKey)}
            </Alert>
          </Box>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            color={isCopied ? "success" : "primary"}
            startIcon={isCopied ? <CheckCircleIcon /> : <ContentCopyIcon />}
            onClick={handleCopy}
            fullWidth
          >
            {isCopied ? t("support.actions.copyAddressSuccess.text") : t("support.actions.copyAddress.text")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setExpandedQR(isExpanded ? null : id)}
            startIcon={isExpanded ? <CloseIcon /> : <QrCodeIcon />}
            fullWidth
          >
            {expandedQR === id ? t("support.actions.hideQR.text") : t("support.actions.showQR.text")}
          </Button>
        </Stack>
        <Collapse in={isExpanded}>
          <Box
            mt={2}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <Box
              width={200}
              height={200}
              display="flex"
              justifyContent="center"
              alignItems="center"
              border="1px solid"
              borderColor="divider"
              borderRadius={1}
              bgcolor="background.paper"
            >
              {qrCodeSvg ? (
                <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
              ) : (
                <CircularProgress />
              )}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};