import { FC } from "react";
import { useTranslation } from "react-i18next";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

import { DismissibleTip } from "@/shared/ui/DismissibleTip/DismissibleTip.tsx";

interface ContextHintProps {
  /** Whether a DeepL key is stored on this device: switching is then one click. */
  hasApiKey: boolean;
  /** Picks DeepL, which opens the key form when there is no key yet. */
  onSelectDeepL: () => void;
}

/**
 * Tells viewers on another translator that DeepL translates a word in the
 * context of its subtitle line. Kept out of the tooltip, which stays one line
 * of translation.
 */
export const ContextHint: FC<ContextHintProps> = ({ hasApiKey, onSelectDeepL }) => {
  const { t } = useTranslation("settings");

  return (
    <DismissibleTip storageKey="deeplTipDismissed" closeText={t("tips.dismiss")}>
      {t("contextHint.text")}
      {!hasApiKey && ` ${t("contextHint.keyNote")}`}
      <Box mt={1}>
        <Button size="small" variant="outlined" color="info" onClick={onSelectDeepL}>
          {t(hasApiKey ? "contextHint.switch" : "contextHint.connect")}
        </Button>
      </Box>
    </DismissibleTip>
  );
};
