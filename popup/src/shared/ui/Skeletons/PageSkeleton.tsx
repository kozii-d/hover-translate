import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";
import { FC, PropsWithChildren } from "react";

export const PageSkeleton: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Container sx={{
      paddingTop: "16px",
      paddingBottom: "16px"
    }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Skeleton variant="rounded" width={180} height={42} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
        <Skeleton variant="rounded" width="100%" height={48} />
        {children}
      </Stack>
    </Container>
  );
};