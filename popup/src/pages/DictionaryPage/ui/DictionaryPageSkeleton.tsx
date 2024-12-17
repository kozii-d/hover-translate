import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export const DictionaryPageSkeleton = () => {
  return (
    <Box>
      <Stack spacing={2}>
        <Skeleton variant="rounded" width="100%" height={27} />
        <Skeleton variant="rounded" width="100%" height={57} />
        <Skeleton variant="rounded" width="100%" height={57} />
        <Skeleton variant="rounded" width="100%" height={57} />
        <Skeleton variant="rounded" width="100%" height={57} />
        <Skeleton variant="rounded" width="100%" height={57} />
        <Skeleton variant="rounded" width="100%" height={57} />
      </Stack>
    </Box>
  );
};