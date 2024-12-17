import { FC, ReactNode } from "react";
import { PageContainer } from "@toolpad/core/PageContainer";
import { Account } from "@toolpad/core/Account";
import { NavTabs } from "@/widgets/NavTabs";

interface PageProps {
  children: ReactNode;
  title: string;
}

export const Page: FC<PageProps> = ({ children, title }) => {
  return (
    <PageContainer title={title} slots={{ toolbar: Account }}>
      <NavTabs />
      {children}
    </PageContainer>
  );
};