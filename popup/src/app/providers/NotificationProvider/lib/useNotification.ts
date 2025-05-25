import { Severity } from "../model/types/types.ts";
import { NotificationContext } from "./NotificationContext.tsx";
import { useCallback, useContext, useMemo } from "react";

interface NotificationOptions {
  severity?: Severity;
  duration?: number | null;
}

export const useNotification = () => {
  const { show: showNotification, setDuration, setMessage, setSeverity } = useContext(NotificationContext);

  const show = useCallback((message: string, options?: NotificationOptions) => {
    setMessage(message);

    if (options?.severity) {
      setSeverity(options.severity);
    }

    if (options?.duration !== undefined) {
      setDuration(options.duration);
    }


    showNotification();
  }, [setDuration, setMessage, setSeverity, showNotification]);

  return useMemo(() => ({
    show
  }), [show]);
};