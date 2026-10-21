import { FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Settings } from "@extension/common/types/settings.ts";
import { Language } from "@extension/common/types/languages.ts";
import { useLanguageOptions } from "@/shared/lib/hooks/useLanguageOptions.ts";
import { LanguageSelect } from "@/shared/ui/LanguageSelect/LanguageSelect.tsx";

interface TargetLanguageFieldProps {
  settings: Settings;
  /** The target languages of the stored translator. */
  languages: Language[];
  onChange: (targetLanguageCode: string) => void;
}

/** "Translate to", named and sorted as on the Settings page. */
export const TargetLanguageField: FC<TargetLanguageFieldProps> = ({ settings, languages, onChange }) => {
  const { t } = useTranslation("settings");
  const { toSortedOptions } = useLanguageOptions(settings.translator);
  const options = useMemo(() => toSortedOptions(languages), [languages, toSortedOptions]);
  // The popup's full-screen panel only in a window as narrow as the popup;
  // across a wide tab it would stretch the list from edge to edge.
  const narrow = useMediaQuery(useTheme().breakpoints.down("sm"), { noSsr: true });

  return (
    <LanguageSelect
      id="targetLanguageCode"
      label={t("fields.targetLanguageCode.label")}
      tooltip={t("fields.targetLanguageCode.tooltip")}
      value={settings.targetLanguageCode}
      onChange={onChange}
      options={options}
      fullScreen={narrow}
    />
  );
};
