import { FC, useCallback, useState } from "react";
import Stack from "@mui/material/Stack";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { Footer } from "./Footer.tsx";
import { Tips } from "@/pages/AboutPage/ui/blocks/Tips.tsx";
import { Contacts } from "./blocks/Contacts.tsx";
import { Description } from "./blocks/Description.tsx";
import { SupportProject } from "./blocks/SupportProject.tsx";
import Divider from "@mui/material/Divider";
import { useTranslation } from "react-i18next";
import { SupportModal } from "@/widgets/SupportModal";

const AboutPage: FC = () => {
  const { t } = useTranslation("about");
  const [isOpenModal, setIsOpenModal] = useState<boolean>(false);

  const openModal = useCallback(() => {
    setIsOpenModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpenModal(false);
  }, []);

  return (
    <Page title={t("pageTitle")}>
      <Stack spacing={2}>
        <SupportModal open={isOpenModal} onClose={closeModal}/>
        <Description />
        <Divider />
        <SupportProject openModal={openModal} />
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