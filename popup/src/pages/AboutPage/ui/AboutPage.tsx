import { FC } from "react";
import Stack from "@mui/material/Stack";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { Footer } from "./Footer.tsx";
import { Tips } from "@/pages/AboutPage/ui/Tips.tsx";
import { Contacts } from "./Contacts.tsx";
import { Description } from "./Description.tsx";
import { SupportProject } from "./SupportProject.tsx";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";

const AboutPage: FC = () => {
  const { t } = useTranslation("about");

  return (
    <Page title={t("pageTitle")}>
      <Stack spacing={2}>
        <Description />
        <Divider />
        <SupportProject />
        <Divider />
        <Contacts />
        <Divider />
        <Tips />
      </Stack>
      <Footer />
    </Page>
  );
};

export default AboutPage;