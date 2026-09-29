import { FC, ReactNode } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { NavTabs } from "@/widgets/NavTabs";
import { LangSelector } from "@/widgets/LangSelector";
import { ThemeToggle } from "@/widgets/ThemeToggle";

interface PageProps {
  children: ReactNode;
  title: string;
  additionalAction?: ReactNode;
}

/** A popup page: its title with the page's actions, the tabs, then the content. */
export const Page: FC<PageProps> = ({ children, title, additionalAction }) => {
  return (
    <Container>
      <Stack sx={{ my: 2 }} spacing={2}>
        <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between", gap: 2 }}>
          <Typography variant="h4">{title}</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            {additionalAction ? additionalAction : null}
            <ThemeToggle />
            <LangSelector />
          </Stack>
        </Box>
        <div>
          <NavTabs />
          {children}
        </div>
      </Stack>
    </Container>
  );
};
