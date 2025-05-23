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
import dayjs from "dayjs";
import { DictionaryContentSkeleton } from "./skeletons/DictionaryContentSkeleton.tsx";
import { EmptyState } from "@/pages/DictionaryPage/ui/EmptyState.tsx";
import { useTranslation } from "react-i18next";
import { ExportData } from "@/features/ExportTranslations";

const MAX_TRANSLATIONS_PER_PAGE = 25;

const DictionaryPage: FC = () => {
  const [allTranslations, setAllTranslations] = useState<Translation[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const { t } = useTranslation("dictionary");

  const translationsToShow = useMemo(() => {
    return allTranslations.slice(0, page * MAX_TRANSLATIONS_PER_PAGE);
  }, [allTranslations, page]);

  const canShowMore = allTranslations.length > translationsToShow.length;

  const chunkedTranslationByDay = useMemo(() => {
    return chunkTranslationsByDay(translationsToShow);
  }, [translationsToShow]);

  const { set, get } = useStorage();

  const getTranslations = useCallback(async () => {
    try {
      const savedTranslations = await get<Translation[]>("savedTranslations", "local");
      if (savedTranslations) {
        setAllTranslations(savedTranslations);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [get]);

  const removeTranslationById = useCallback((id: string) => {
    try {
      const updatedTranslations = allTranslations.filter(translation => translation.id !== id);
      setAllTranslations(updatedTranslations);
      set<Translation[]>("savedTranslations", updatedTranslations, "local");
    } catch (error) {
      console.error(error);
    }
  }, [set, allTranslations]);

  const clearAllTranslations = () => {
    setAllTranslations([]);
    set<Translation[]>("savedTranslations", [], "local");
  };

  const showNextPage = () => {
    setPage((prev) => prev + 1);
  };

  useEffect(() => {
    setLoading(true);
    getTranslations()
      .finally(() => setLoading(false));
  }, [get, getTranslations]);

  if (loading) {
    return (
      <Page title="Dictionary">
        <DictionaryContentSkeleton/>
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
                {dayjs(translations[0].timestamp).format("ddd, MMM D, YYYY")}
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