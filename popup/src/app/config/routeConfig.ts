import {FC, ReactNode} from "react";

import { RouterPath } from "./routerPath";
import {SettingsPage, SettingsFormSkeleton} from "@/pages/SettingsPage";

export interface RouteConfig {
  path: string,
  element: FC,
  skeleton?: FC,
  guards?: FC<{ children: ReactNode }>[]
}

export const routeConfig: RouteConfig[] = [
  {
    path: RouterPath.settings,
    element: SettingsPage,
    skeleton: SettingsFormSkeleton
  },
];
