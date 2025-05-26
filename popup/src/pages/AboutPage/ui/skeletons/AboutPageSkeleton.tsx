import { FC } from "react";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";
import Divider from "@mui/material/Divider";

export const AboutPageSkeleton: FC = () => {
  return (
    <PageSkeleton>
      <Stack spacing={2}>
        <Skeleton variant="rounded" width="100%" height={96.4} />
        <Divider />
        <Skeleton variant="rounded" width="100%" height={75.5} />
        <Divider />
        <Skeleton variant="rounded" width="100%" height={199} />
        <Divider />
        <Skeleton variant="rounded" width="100%" height={81} />
      </Stack>
      <Divider sx={{ marginInline: -2, mt: 2 }}/>
      <Skeleton variant="rounded" width="100%" height={37} />
    </PageSkeleton>
  );
};