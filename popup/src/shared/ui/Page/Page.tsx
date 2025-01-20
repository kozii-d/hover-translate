import { FC, ReactNode } from "react";
import { PageContainer } from "@toolpad/core/PageContainer";
// import { Account } from "@toolpad/core/Account";
import { NavTabs } from "@/widgets/NavTabs";
import Stack from "@mui/material/Stack";
import { LangSelector } from "@/widgets/LangSelector";

interface PageProps {
  children: ReactNode;
  title: string;
  additionalAction?: ReactNode;
}

export const Page: FC<PageProps> = ({ children, title, additionalAction }) => {
  return (
    <PageContainer title={title} slots={{ 
      toolbar: () => {
        return (
          <Stack direction="row" spacing={2} alignItems="center">
            {additionalAction ? additionalAction : null}
            <LangSelector />
            {/*<Account />*/}
          </Stack>
        );
      } 
    }}
    >
      <NavTabs />
      {children}
    </PageContainer>
  );
};