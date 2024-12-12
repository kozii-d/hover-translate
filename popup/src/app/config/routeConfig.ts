import { FC, ReactNode } from "react";

import { RouterPath } from "./routerPath";
import { SettingsPage } from "@/pages/SettingsPage";
import { LoginPage } from "@/pages/LoginPage";
import { AuthGuard } from "../guards/AuthGuard.tsx";

export interface RouteConfig {
  path: string,
  element: FC,
  guards?: FC<{ children: ReactNode }>[]
}

export const routeConfig: RouteConfig[] = [
  {
    path: RouterPath.settings,
    element: SettingsPage,
    guards: [AuthGuard]
  },
  {
    path: RouterPath.login,
    element: LoginPage,
  }
];
