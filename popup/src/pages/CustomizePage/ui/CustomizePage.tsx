import { CustomizeForm } from "./CustomizeForm.tsx";
import { CustomizeFormSkeleton } from "./skeletons/CustomizeFormSkeleton.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { CustomizeFormValues } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/shared/lib/notifications/notifications.ts";
import { ErrorState } from "@/shared/ui/ErrorState/ErrorState.tsx";

const CustomizePage: FC = () => {
  const [initialValues, setInitialValues] = useState<CustomizeFormValues>(initialFormValues);

  // The form is mounted only with the stored theme: drawn with the defaults
  // first, it would show them for a frame before correcting itself.
  const [loading, setLoading] = useState<boolean>(true);
  // Not the defaults instead: any change in that form would overwrite the stored theme.
  const [loadFailed, setLoadFailed] = useState(false);

  const { t } = useTranslation("customize");

  const { set, get } = useStorage();

  const notifications = useNotifications();

  const setInitialSettings = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const tooltipTheme = await get<CustomizeFormValues>("tooltipTheme", "sync");
      if (tooltipTheme) {
        setInitialValues(tooltipTheme);
      }
    } catch (error) {
      console.error("Could not load the tooltip theme", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: CustomizeFormValues) => {
    try {
      await set<CustomizeFormValues>("tooltipTheme", values, "sync");
      setInitialValues(values);
    } catch (error) {
      const errorMessage = "Failed to save tooltipTheme";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
      setInitialSettings();
    }
  }, [notifications, set, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
      {loading ? <CustomizeFormSkeleton/> : loadFailed ? <ErrorState onRetry={setInitialSettings}/> : (
        <CustomizeForm
          initialValues={initialValues}
          onSubmit={handleSubmit}
        />
      )}
    </Page>
  );
};

export default CustomizePage;