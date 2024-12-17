import { SyntheticEvent } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useLocation, useNavigate } from "react-router";
import { RouterPath } from "@/app/config/routerPath.ts";

interface Tab {
  label: string;
  value: (typeof RouterPath)[keyof typeof RouterPath];
}
const TABS: Tab[] = [
  { label: "Settings", value: RouterPath.settings },
  { label: "Customize", value: RouterPath.customize },
  { label: "Dictionary", value: RouterPath.dictionary },
];

export const NavTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleChange = (_: SyntheticEvent, newPath: string) => {
    navigate(newPath);
  };
  
  return (
    <Tabs
      value={location.pathname}
      onChange={handleChange}
      sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "16px" }}
    >
      {TABS.map((tab) => (
        <Tab key={tab.value} label={tab.label} value={tab.value} />
      ))}
    </Tabs>
  );
};