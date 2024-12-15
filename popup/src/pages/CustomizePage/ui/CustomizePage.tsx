import { Formik } from "formik";
import { CustomizeForm } from "./CustomizeForm.tsx";
import { FC, useCallback, useEffect, useState } from "react";
import { CustomizeFormValues } from "../model/types/schema.ts";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";

export const CustomizePage: FC = () => {
  const [initialValues, setInitialValues] = useState<CustomizeFormValues>({
    useYouTubeSettings: true,
    fontFamily: "auto",
    fontColor: "auto",
    fontSize: "auto",
    backgroundColor: "auto",
    backgroundOpacity: "auto",
    characterEdgeStyle: "auto",
    fontOpacity: "auto"
  });

  const [loading, setLoading] = useState<boolean>(false);

  const { set, get } = useStorage();

  const setInitialSettings = useCallback(async () => {
    setLoading(true);
    try {
      const customize = await get<CustomizeFormValues>("customize");
      if (customize) {
        setInitialValues(customize);
      }
    } catch (error) {
      console.error("Failed to get customize settings:", error);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    setInitialSettings();
  }, [setInitialSettings]);

  const handleSubmit = useCallback(async (values: CustomizeFormValues) => {
    return set<CustomizeFormValues>("customize", values).then(setInitialSettings);
  }, [set, setInitialSettings]);

  return (
    <Page title="Cusomize">
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