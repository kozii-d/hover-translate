import { DictionaryContentSkeleton } from "./DictionaryContentSkeleton.tsx";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";

export const DictionaryPageSkeleton = () => {
  return (
    <PageSkeleton>
      <DictionaryContentSkeleton/>
    </PageSkeleton>

  );
};