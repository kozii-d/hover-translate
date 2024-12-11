import {Formik} from "formik";
import {SettingsForm} from "./SettingsForm.tsx";
import {FC, useCallback, useEffect, useState} from "react";
import {Language, LanguageResponse, SettingsFormValues} from "../model/types/schema.ts";
import {PageContainer} from '@toolpad/core/PageContainer';
import { Account } from '@toolpad/core/Account';
import {api} from "@/shared/api/api.ts";

export const SettingsPage: FC = () => {
  const [initialValues, setInitialValues] = useState({ sourceLanguageCode: "", targetLanguageCode: "", autoPause: false });

  const [sourceLanguages, setSourceLanguages] = useState<Language[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const setInitialLanguages = useCallback(() => {
    chrome.storage.sync.get(["settings"], (result) => {
      const { settings } = result;

      if (!settings) {
        return;
      }

      setInitialValues(settings);
    });
  }, []);

  useEffect(() => {
    setInitialLanguages();
  }, [setInitialLanguages]);

  useEffect(() => {
    const fetchLanguagesData = async () => {
      setLoading(true);
      try {
        const response = await api.get<LanguageResponse>("/translation/languages");
        setSourceLanguages(response.data.sourceLanguages);
        setTargetLanguages(response.data.targetLanguages);
      } catch (error) {
        console.error("Failed to fetch source languages", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLanguagesData();
  }, []);


  const handleSubmit = (values: SettingsFormValues) => {
    chrome.storage.sync.set({
      settings: values,
    }, () => {
      setInitialLanguages();
    });
  };

  return (
    <PageContainer title="Settings" slots={{ toolbar: Account }}>
       <Formik
         enableReinitialize
         onSubmit={handleSubmit}
         initialValues={initialValues}
       >
         {props => (
           <SettingsForm
             {...props}
             sourceLanguages={sourceLanguages}
             targetLanguages={targetLanguages}
             loading={loading}
           />
         )}
       </Formik>
    </PageContainer>
  )
}