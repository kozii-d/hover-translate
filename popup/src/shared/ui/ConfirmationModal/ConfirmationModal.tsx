import { FC, Fragment, useState, cloneElement, ReactElement } from "react";
import Modal from "@mui/material/Modal";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";

interface ConfirmationModalProps {
  title: string;
  description: string;
  trigger: ReactElement;
  actionText?: string;
  onConfirm: () => void;
}

export const ConfirmationModal: FC<ConfirmationModalProps> = (props) => {
  const { title, description, actionText, trigger, onConfirm } = props;
  
  const { t } = useTranslation("modals");

  const [open, setOpen] = useState(false);
  
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const triggerElement = trigger
    ? cloneElement(trigger, { onClick: handleOpen })
    : null;

  return (
    <Fragment>
      {triggerElement}
      <Modal
        open={open}
        onClose={handleClose}
      >
        <Box sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "80%",
          bgcolor: "background.paper",
          border: "2px solid #000",
          boxShadow: 24,
          p: 4,
        }}>
          <Stack direction="column" spacing={2}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            <Typography>
              {description}
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="end">
              <Button size="small" onClick={handleClose}>{t("confirmation.actions.close.text")}</Button>
              <Button size="small" variant="contained" color="primary" onClick={onConfirm}>{actionText || t("confirmation.actions.confirm.text")}</Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>
    </Fragment>
  );
};