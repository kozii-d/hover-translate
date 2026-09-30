import LanguageIcon from "@mui/icons-material/Language";
import IconButton from "@mui/material/IconButton";
import { Fragment, useState, MouseEvent, FC, useMemo } from "react";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import { languageNamesIn } from "@/shared/lib/helpers/languageNames.ts";

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

  // Each language in itself, so a viewer who got the popup in a language they
  // do not read still recognises their own.
  const getLanguageName = (lang: string) => languageNamesIn(lang)(lang) || lang;

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