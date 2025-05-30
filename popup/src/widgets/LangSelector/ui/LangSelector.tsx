import LanguageIcon from "@mui/icons-material/Language";
import IconButton from "@mui/material/IconButton";
import { Fragment, useState, MouseEvent, FC, useMemo } from "react";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";

export const LangSelector: FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { i18n, t } = useTranslation("common");
  const supportedLanguages = useMemo(() => {
    return (i18n.options.supportedLngs || []).filter((lang: string) => lang !== "cimode");
  }, [i18n.options.supportedLngs]);
  
  const activeLang = i18n.language;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (lang: string) => {
    i18n.changeLanguage(lang);
    handleClose();
  };

  const getLanguageName = (langCode: string) => {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(langCode.replace("_", "-")) || langCode;
  };

  return (
    <Fragment>
      <IconButton onClick={handleClick} title={t("tooltips.languageSelector")}>
        <LanguageIcon />
      </IconButton>
      <Menu
        id="lang-selector-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {supportedLanguages.map((lang: string) => (
          <MenuItem 
            key={lang} 
            onClick={() => handleMenuItemClick(lang)}
            disabled={lang === activeLang}
          >
            {getLanguageName(lang)}
          </MenuItem>
        ))}
      </Menu>
    </Fragment>
  );
};