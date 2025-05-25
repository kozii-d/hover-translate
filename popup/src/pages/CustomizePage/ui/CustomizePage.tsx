import { CustomizeForm } from "./CustomizeForm.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { CustomizeFormValues } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { useTranslation } from "react-i18next";
import { useNotification } from "@/app/providers/NotificationProvider";

const CustomizePage: FC = () => {
  const [initialValues, setInitialValues] = useState<CustomizeFormValues>(initialFormValues);

  const [loading, setLoading] = useState<boolean>(false);

  const { t } = useTranslation("customize");

  const { set, get } = useStorage();

  const notification = useNotification();

  const setInitialSettings = useCallback(async () => {
    setLoading(true);
    try {
      const tooltipTheme = await get<CustomizeFormValues>("tooltipTheme", "sync");
      if (tooltipTheme) {
        setInitialValues(tooltipTheme);
      }
    } catch (error) {
      const errorMessage = "Failed to get tooltipTheme";
      notification.show(errorMessage, { severity: "error" });
      console.error(errorMessage, error);
    } finally {
      setLoading(false);
    }
  }, [get, notification]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: CustomizeFormValues) => {
    try {
      await set<CustomizeFormValues>("tooltipTheme", values, "sync");
      setInitialValues(values);
    } catch (error) {
      const errorMessage = "Failed to save tooltipTheme";
      notification.show(errorMessage, { severity: "error" });
      console.error(errorMessage, error);
      setInitialSettings();
    }
  }, [notification, set, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
      <CustomizeForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </Page>
  );
};

export default CustomizePage;