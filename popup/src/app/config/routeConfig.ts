import { FC, ReactNode } from "react";

import { RouterPath } from "./routerPath";
import { SettingsPage } from "@/pages/SettingsPage";
import { LoginPage } from "@/pages/LoginPage";
import { AuthGuard } from "../guards/AuthGuard.tsx";
import { CustomizePage } from "@/pages/CustomizePage";
import { DictionaryPage } from "@/pages/DictionaryPage";

export interface RouteConfig {
  path: string,
  element: FC,
  guards?: FC<{ children: ReactNode }>[]
}

export const routeConfig: RouteConfig[] = [
  {
    path: RouterPath.login,
    element: LoginPage,
  },
  {
    path: RouterPath.settings,
    element: SettingsPage,
    guards: [AuthGuard]
  },
  {
    path: RouterPath.customize,
    element: CustomizePage,
    guards: [AuthGuard]
  },
  {
    path: RouterPath.dictionary,
    element: DictionaryPage,
    guards: [AuthGuard]
  }
];
