import { createContext } from "react";
import { Severity } from "../model/types/types.ts";

export interface NotificationContextProps {
  show: () => void;
  setSeverity: (severity: Severity) => void;
  setMessage: (message: string) => void;
  setDuration: (duration: number | null) => void;
}

export const NotificationContext = createContext<NotificationContextProps>({
  show: () => {},
  setSeverity: () => {},
  setMessage: () => {},
  setDuration: () => {},
});
