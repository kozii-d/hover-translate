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
  const { t } = useTranslation(["settings", "customize", "dictionary", "about"]);

  const tabs: Tab[] = [
    { label: t("tabLabel", { ns: "settings" }), value: RouterPath.settings },
    { label: t("tabLabel", { ns: "customize" }), value: RouterPath.customize },
    { label: t("tabLabel", { ns: "dictionary" }), value: RouterPath.dictionary },
    { label: t("tabLabel", { ns: "about" }), value: RouterPath.about },
  ];

  const handleChange = (_: SyntheticEvent, newPath: string) => {
    navigate(newPath);
  };

  return (
    <Tabs
      value={location.pathname}
      onChange={handleChange}
      variant="scrollable"
      sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "16px" }}
    >
      {tabs.map((tab) => (
        <Tab key={tab.value} label={tab.label} value={tab.value} title={tab.label} />
      ))}
    </Tabs>
  );
};