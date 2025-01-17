import { Formik } from "formik";
import { CustomizeForm } from "./CustomizeForm.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { CustomizeFormValues } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { initialFormValues } from "../model/consts/initialValues.ts";
import { useTranslation } from "react-i18next";

const CustomizePage: FC = () => {
  const [initialValues, setInitialValues] = useState<CustomizeFormValues>(initialFormValues);

  const [loading, setLoading] = useState<boolean>(false);

  const { t } = useTranslation("customize");

  const { set, get } = useStorage();

  const setInitialSettings = useCallback(async () => {
    setLoading(true);
    try {
      const tooltipTheme = await get<CustomizeFormValues>("tooltipTheme", "sync");
      if (tooltipTheme) {
        setInitialValues(tooltipTheme);
      }
    } catch (error) {
      console.error("Failed to get tooltipTheme:", error);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: CustomizeFormValues) => {
    return set<CustomizeFormValues>("tooltipTheme", values, "sync").then(setInitialSettings);
  }, [set, setInitialSettings]);

  return (
    <Page title={t("pageTitle")}>
      <Formik
        enableReinitialize
        onSubmit={handleSubmit}
        initialValues={initialValues}
      >
        {props => (
          <CustomizeForm
            {...props}
            loading={loading}
          />
        )}
      </Formik>
    </Page>
  );
};

export default CustomizePage;