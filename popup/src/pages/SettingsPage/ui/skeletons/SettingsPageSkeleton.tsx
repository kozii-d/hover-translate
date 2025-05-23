import { SettingsFormSkeleton } from "./SettingsFormSkeleton.tsx";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";

export const SettingsPageSkeleton = () => {
  return (
    <PageSkeleton>
      <SettingsFormSkeleton/>
    </PageSkeleton>
  );
};