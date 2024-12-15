import { FC, ReactNode } from "react";
import { PageContainer } from "@toolpad/core/PageContainer";
import { Account } from "@toolpad/core/Account";
import { NavTabs } from "@/widgets/NavTabs";
import Stack from "@mui/material/Stack";

interface PageProps {
  children: ReactNode;
  title: string;
}

export const Page: FC<PageProps> = ({ children, title }) => {
  return (
    <PageContainer title={title} slots={{ toolbar: Account }}>
      <Stack spacing={2}>
        <NavTabs />
        {children}
      </Stack>
    </PageContainer>
  );
};