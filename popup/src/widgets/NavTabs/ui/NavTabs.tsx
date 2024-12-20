import { SyntheticEvent } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useLocation, useNavigate } from "react-router";
import { RouterPath } from "@/app/config/routerPath.ts";
import { useTranslation } from "react-i18next";

interface Tab {
  label: string;
  value: (typeof RouterPath)[keyof typeof RouterPath];
}

export const NavTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(["settings", "customization", "dictionary"]);

  const tabs: Tab[] = [
    { label: t("tabLabel", { ns: "settings" }), value: RouterPath.settings },
    { label: t("tabLabel", { ns: "customization" }), value: RouterPath.customize },
    { label: t("tabLabel", { ns: "dictionary" }), value: RouterPath.dictionary },
  ];

  const handleChange = (_: SyntheticEvent, newPath: string) => {
    navigate(newPath);
  };

  return (
    <Tabs
      value={location.pathname}
      onChange={handleChange}
      sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "16px" }}
    >
      {tabs.map((tab) => (
        <Tab key={tab.value} label={tab.label} value={tab.value} title={tab.label} />
      ))}
    </Tabs>
  );
};