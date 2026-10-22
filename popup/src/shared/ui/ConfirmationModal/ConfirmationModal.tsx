import { FC, Fragment, useId, useState, cloneElement, ReactElement } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslation } from "react-i18next";

interface ConfirmationModalProps {
  title: string;
  description: string;
  trigger: ReactElement<{ onClick?: () => void }>;
  actionText?: string;
  onConfirm: () => void;
}

/** Asks before something that cannot be undone (a reset, a removal): its button is red. */
export const ConfirmationModal: FC<ConfirmationModalProps> = (props) => {
  const { title, description, actionText, trigger, onConfirm } = props;

  const { t } = useTranslation("modals");
  const titleId = useId();

  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const triggerElement = trigger
    ? cloneElement(trigger, { onClick: handleOpen })
    : null;

  const handleConfirm = () => {
    onConfirm();
    handleClose();
  };

  return (
    <Fragment>
      {triggerElement}
      <Dialog open={open} onClose={handleClose} aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={handleClose}>{t("confirmation.actions.close.text")}</Button>
          <Button size="small" variant="contained" color="error" onClick={handleConfirm}>{actionText || t("confirmation.actions.confirm.text")}</Button>
        </DialogActions>
      </Dialog>
    </Fragment>
  );
};
