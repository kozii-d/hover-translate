import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export const SettingsSkeleton = () => {
  return (
    <Box>
      <Skeleton variant="text" sx={{ fontSize: '1.25rem' }} />
      <Stack spacing={2}>
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={36.5} />
      </Stack>
    </Box>
  )
}