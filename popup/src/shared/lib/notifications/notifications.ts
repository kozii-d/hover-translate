import { createContext, ReactNode, useContext } from "react";
import { AlertColor } from "@mui/material/Alert";

export interface NotificationOptions {
  severity: AlertColor;
  autoHideDuration?: number;
}

export interface Notifications {
  /** Queues a notification and returns the key that `close` takes. */
  show: (message: ReactNode, options: NotificationOptions) => string;
  close: (key: string) => void;
}

/** Provided by `NotificationsProvider` (`shared/ui/Notifications`). */
export const NotificationsContext = createContext<Notifications | null>(null);

export const useNotifications = (): Notifications => {
  const notifications = useContext(NotificationsContext);
  if (!notifications) throw new Error("useNotifications() is used outside NotificationsProvider");
  return notifications;
};
