import { CustomizeFormSkeleton } from "./CustomizeFormSkeleton.tsx";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";

export const CustomizePageSkeleton = () => {
  return (
    <PageSkeleton>
      <CustomizeFormSkeleton/>
    </PageSkeleton>

  );
};