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
import { DictionaryPageSkeleton } from "./DictionaryPageSkeleton.tsx";

const MAX_TRANSLATIONS_PER_PAGE = 25;

export const DictionaryPage: FC = () => {
  const [allTranslations, setAllTranslations] = useState<Translation[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

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
        <DictionaryPageSkeleton/>
      </Page>
    );
  }

  return (
    <Page title="Dictionary">
      <Stack direction="column">
        {chunkedTranslationByDay.map((translations) => {
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
        })}
        <Stack spacing={2}>
          {allTranslations.length > 0 ? (
            <ConfirmationModal
              trigger={(
                <Button
                  variant="text"
                  color="error"
                >
                  Clear all
                </Button>
              )}
              title="Clear all translations?"
              description="This will remove all translations from the dictionary."
              actionText="Clear"
              onConfirm={clearAllTranslations}
            />
          ) : null}
          {canShowMore && (
            <Button
              variant="contained"
              color="primary"
              onClick={showNextPage}
            >
              Show more
            </Button>
          )}
        </Stack>
      </Stack>
    </Page>
  );
};
