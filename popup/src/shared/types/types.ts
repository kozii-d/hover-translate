import { ReactNode } from "react";

export interface MenuItemType<V = string> {
  value: V;
  label: string;
  /** A second line shown under the label in the open menu only. */
  description?: string;
  /** Drawn after the label, in the open menu and in the closed select. */
  icon?: ReactNode;
}
