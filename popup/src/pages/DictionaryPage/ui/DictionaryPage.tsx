import { FC, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/shared/ui/Page/Page.tsx";
import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import { Translation } from "../model/types/schema.ts";
import { TranslationRecord } from "./TranslationRecord.tsx";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";
import { chunkTranslationsByDay } from "../lib/helpers/chunkTranslationsByDay.ts";
import Typography from "@mui/material/Typography";
import { DictionaryContentSkeleton } from "./skeletons/DictionaryContentSkeleton.tsx";
import { EmptyState } from "@/pages/DictionaryPage/ui/EmptyState.tsx";
import { useTranslation } from "react-i18next";
import { ExportData } from "@/features/ExportTranslations";
import { useNotifications } from "@/shared/lib/notifications/notifications.ts";
import { toTag } from "@/shared/lib/helpers/languageNames.ts";
import { ErrorState } from "@/shared/ui/ErrorState/ErrorState.tsx";

const MAX_TRANSLATIONS_PER_PAGE = 25;

const DictionaryPage: FC = () => {
  const [allTranslations, setAllTranslations] = useState<Translation[]>([]);
  const [page, setPage] = useState<number>(1);
  // True from the start: drawn before the read, the page would say it is empty.
  const [loading, setLoading] = useState<boolean>(true);
  // Not "empty" instead: the viewer would think the words are gone.
  const [loadFailed, setLoadFailed] = useState(false);
  const { t, i18n } = useTranslation("dictionary");

  const dayFormat = useMemo(() => {
    return new Intl.DateTimeFormat(toTag(i18n.language), { dateStyle: "full" });
  }, [i18n.language]);

  const translationsToShow = useMemo(() => {
    return allTranslations.slice(0, page * MAX_TRANSLATIONS_PER_PAGE);
  }, [allTranslations, page]);

  const canShowMore = allTranslations.length > translationsToShow.length;

  const chunkedTranslationByDay = useMemo(() => {
    return chunkTranslationsByDay(translationsToShow);
  }, [translationsToShow]);

  const { set, get } = useStorage();

  const notifications = useNotifications();

  const getTranslations = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const savedTranslations = await get<Translation[]>("savedTranslations", "local");
      if (savedTranslations) {
        setAllTranslations(savedTranslations);
      }
    } catch (error) {
      console.error("Could not load the saved translations", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [get]);

  const removeTranslationById = useCallback(async (id: string) => {
    try {
      const updatedTranslations = allTranslations.filter(translation => translation.id !== id);
      setAllTranslations(updatedTranslations);
      await set<Translation[]>("savedTranslations", updatedTranslations, "local");
    } catch (error) {
      const errorMessage = "Failed to remove translation";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    }
  }, [allTranslations, set, notifications]);

  const clearAllTranslations = useCallback(async () => {
    try {
      setAllTranslations([]);
      await set<Translation[]>("savedTranslations", [], "local");
    } catch (error) {
      const errorMessage = "Failed to clear all translations";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    }
  }, [set, notifications]);

  const showNextPage = () => {
    setPage((prev) => prev + 1);
  };

  useEffect(() => {
    getTranslations();
  }, [getTranslations]);

  if (loading) {
    return (
      <Page title={t("pageTitle")}>
        <DictionaryContentSkeleton/>
      </Page>
    );
  }

  if (loadFailed) {
    return (
      <Page title={t("pageTitle")}>
        <ErrorState onRetry={getTranslations}/>
      </Page>
    );
  }

  return (
    <Page title={t("pageTitle")} additionalAction={<ExportData />}>
      <Stack direction="column">
        {chunkedTranslationByDay.length ? chunkedTranslationByDay.map((translations) => {
          return (
            <Fragment key={translations[0].timestamp}>
              <Typography color="textSecondary" align="center">
                {dayFormat.format(translations[0].timestamp)}
              </Typography>
              {translations.map((translation, index) => {
                return (
                  <TranslationRecord
                    key={translation.id}
                    translation={translation}
                    onRemove={removeTranslationById}
                    isLast={index === translations.length - 1}
                  />
                );
              })}
            </Fragment>
          );
        }) : <EmptyState />}
        <Stack spacing={2}>
          {allTranslations.length > 0 ? (
            <ConfirmationModal
              trigger={(
                <Button
                  variant="text"
                  color="error"
                  title={t("actions.clearAll.tooltip")}
                >
                  {t("actions.clearAll.text")}
                </Button>
              )}
              title={t("modals.clearAll.title")}
              description={t("modals.clearAll.description")}
              actionText={t("modals.clearAll.action")}
              onConfirm={clearAllTranslations}
            />
          ) : null}
          {canShowMore && (
            <Button
              variant="contained"
              color="primary"
              onClick={showNextPage}
              title={t("actions.showMore.tooltip")}
            >
              {t("actions.showMore.text")}
            </Button>
          )}
        </Stack>
      </Stack>
    </Page>
  );
};

export default DictionaryPage;