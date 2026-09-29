import { FC, ReactNode, SyntheticEvent, useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Snackbar, { SnackbarCloseReason } from "@mui/material/Snackbar";
import CloseIcon from "@mui/icons-material/Close";
import { NotificationOptions, NotificationsContext } from "@/shared/lib/notifications/notifications.ts";

interface QueuedNotification {
  key: string;
  message: ReactNode;
  options: NotificationOptions;
}

let nextKey = 0;

interface NotificationProps {
  message: ReactNode;
  options: NotificationOptions;
  /** How many notifications wait behind this one, counting it; shown from two. */
  queued: number;
  onClose: () => void;
}

const Notification: FC<NotificationProps> = ({ message, options, queued, onClose }) => {
  const handleClose = (_event: Event | SyntheticEvent | null, reason?: SnackbarCloseReason) => {
    // A click elsewhere in the popup does not dismiss it: only the button or the timeout.
    if (reason === "clickaway") return;
    onClose();
  };

  return (
    <Snackbar open autoHideDuration={options.autoHideDuration} onClose={handleClose}>
      <Badge badgeContent={queued > 1 ? String(queued) : null} color="primary" sx={{ width: "100%" }}>
        <Alert
          severity={options.severity}
          sx={{ width: "100%" }}
          action={
            <IconButton size="small" aria-label="Close" title="Close" color="inherit" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {message}
        </Alert>
      </Badge>
    </Snackbar>
  );
};

/**
 * Notifications shown one at a time at the bottom of the popup, the others
 * waiting in a queue whose length the badge shows.
 */
export const NotificationsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);

  const show = useCallback((message: ReactNode, options: NotificationOptions) => {
    const key = `notification-${nextKey++}`;
    setQueue((previous) => [...previous, { key, message, options }]);
    return key;
  }, []);

  const close = useCallback((key: string) => {
    setQueue((previous) => previous.filter((notification) => notification.key !== key));
  }, []);

  const notifications = useMemo(() => ({ show, close }), [show, close]);
  const current = queue[0];

  return (
    <NotificationsContext.Provider value={notifications}>
      {children}
      {current && (
        <Notification
          key={current.key}
          message={current.message}
          options={current.options}
          queued={queue.length}
          onClose={() => close(current.key)}
        />
      )}
    </NotificationsContext.Provider>
  );
};
