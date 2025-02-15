import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Container from "@mui/material/Container";

export const PageSkeleton = () => {
  return (
    <Container sx={{
      paddingTop: "16px",
      paddingBottom: "16px"
    }}>
      <Box>
        <Stack spacing={2}>
          <Skeleton variant="rounded" width="100%" height={36.5} />
          <Skeleton variant="rounded" width="100%" height={50} />
          <Skeleton variant="rounded" width="100%" height={48} />
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={56} />
          <Skeleton variant="rounded" width="100%" height={80.83} />
          <Skeleton variant="rounded" width="100%" height={36.5} />
          <Skeleton variant="rounded" width="100%" height={36.5} />
        </Stack>
      </Box>
    </Container>
  );
};