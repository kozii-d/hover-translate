import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export const SettingsFormSkeleton = () => {
  return (
    <Box>
      <Stack spacing={2}>
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={80.83} />
        <Skeleton variant="rounded" width="100%" height={36.5} />
        <Skeleton variant="rounded" width="100%" height={36.5} />
      </Stack>
    </Box>
  );
};