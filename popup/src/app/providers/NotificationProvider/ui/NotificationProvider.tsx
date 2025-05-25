import { Alert, Snackbar, SnackbarCloseReason } from "@mui/material";
import { FC, PropsWithChildren, SyntheticEvent, useState, useMemo, useCallback } from "react";
import { NotificationContext } from "../lib/NotificationContext.tsx";
import { Severity } from "../model/types/types.ts";

const DEFAULT_DURATION: number = 5000;

export const NotificationProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  
  const [severity, setSeverity] = useState<Severity>(null);
  const [message, setMessage] = useState<string>("");
  const [duration, setDuration] = useState<number | null>(DEFAULT_DURATION);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback((
    _: SyntheticEvent | Event,
    reason?: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setIsOpen(false);
    setSeverity(null);
    setMessage("");
    setDuration(DEFAULT_DURATION);
  }, []);

  const contextValue = useMemo(() => ({
    show: handleOpen,
    hide: handleClose,
    setSeverity,
    setMessage,
    setDuration,
  }), [handleClose, handleOpen]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <Snackbar open={isOpen} autoHideDuration={duration} onClose={handleClose} message={severity ?? message}>
        {severity ? (
          <Alert
            onClose={handleClose}
            severity={severity}
            variant="filled"
          >
            {message}
          </Alert>
        ) : undefined
        }
      </Snackbar>
    </NotificationContext.Provider>
  );
};