import { FC, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import StarIcon from "@mui/icons-material/Star";
import { useTranslation } from "react-i18next";

import { useStorage } from "@/shared/lib/hooks/useStorage.ts";
import {
  RATING_PROMPT_DONE_KEY,
  RATING_PROMPT_POPUP_KEY,
  RatingPromptPopupDismissals,
  getReviewPageUrl,
} from "@extension/common/ratingPrompt.ts";

const ISSUES_URL = "https://github.com/kozii-d/hover-translate/issues";

/**
 * The same request for everyone, with the way to report a problem right next
 * to it rather than instead of it: whoever is unhappy sees "Rate" too.
 */
export const RatingPromptCard: FC = () => {
  const { t } = useTranslation("settings");
  const { get, set } = useStorage();
  const [open, setOpen] = useState(true);

  if (!open) return null;

  const endRequest = () => set(RATING_PROMPT_DONE_KEY, true, "sync")
    .catch((error) => console.error("Could not remember that the rating request is done", error));

  const rate = async () => {
    setOpen(false);
    // The browser closes the popup as soon as the new tab opens, so the flag
    // is written first or it may never be.
    await endRequest();

    const url = getReviewPageUrl(chrome.runtime.getURL(""), chrome.runtime.id);
    if (url) chrome.tabs.create({ url });
  };

  const dontAskAgain = () => {
    setOpen(false);
    endRequest();
  };

  // Put off for a month; the third time, for good.
  const notNow = () => {
    setOpen(false);
    get<RatingPromptPopupDismissals>(RATING_PROMPT_POPUP_KEY, "sync")
      .then((dismissals) => set<RatingPromptPopupDismissals>(RATING_PROMPT_POPUP_KEY, {
        count: (dismissals?.count ?? 0) + 1,
        lastDismissedAt: Date.now(),
      }, "sync"))
      .catch((error) => console.error("Could not put the rating card off", error));
  };

  return (
    // "status", not the Alert's own "alert": a screen reader waits for a pause
    // instead of cutting in.
    <Alert severity="info" role="status" onClose={notNow} closeText={t("ratingPrompt.notNow")}>
      {t("ratingPrompt.text")}
      <Box mt={1}>
        <Button size="small" variant="outlined" color="info" startIcon={<StarIcon/>} onClick={rate}>
          {t("ratingPrompt.rate")}
        </Button>
      </Box>
      {/* Side by side when they fit, one under the other when not — with no
          separator left hanging at the end of a line. */}
      <Box mt={1} display="flex" flexWrap="wrap" columnGap={2} rowGap={0.5}>
        <Link component="button" type="button" variant="body2" color="inherit" onClick={dontAskAgain}>
          {t("ratingPrompt.dontAskAgain")}
        </Link>
        <Link component="button" type="button" variant="body2" color="inherit" onClick={() => chrome.tabs.create({ url: ISSUES_URL })}>
          {t("ratingPrompt.reportProblem")}
        </Link>
      </Box>
    </Alert>
  );
};
