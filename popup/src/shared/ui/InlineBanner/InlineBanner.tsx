import Stack from "@mui/material/Stack";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import Typography from "@mui/material/Typography";
import { FC } from "react";

const iconMap = {
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

interface InlineBannerProps {
  message: string;
  type: "info" | "warning" | "error";
}
export const InlineBanner: FC<InlineBannerProps> = (props) => {
  const { message, type } = props;
  
  const Icon = iconMap[type];
  
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Icon color={type} />
      <Typography color={type}>
        {message}
      </Typography>
    </Stack>
  );
};