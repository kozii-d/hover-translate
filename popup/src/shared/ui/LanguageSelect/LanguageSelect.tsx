import { FC, KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemButton from "@mui/material/ListItemButton";
import Slide from "@mui/material/Slide";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import { toTag } from "@/shared/lib/helpers/languageNames.ts";
import { MenuItemType } from "../../types/types.ts";
import { OptionLabel } from "../OptionLabel/OptionLabel.tsx";
import { SettingsSelect } from "../SettingsSelect/SettingsSelect.tsx";

export interface LanguageOption extends MenuItemType {
  /** The translator's English name of the language, searched as well as `label`. */
  englishName?: string;
}

interface LanguageSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  tooltip?: string;
  options: LanguageOption[];
}

/**
 * A language field: it looks like the other settings fields, and opens a
 * panel over the whole popup with a search and the languages in two columns.
 */
export const LanguageSelect: FC<LanguageSelectProps> = ({ id, value, onChange, label, tooltip, options }) => {
  const [open, setOpen] = useState(false);
  const titleId = `${id}-panel-title`;

  const pick = (option: LanguageOption) => {
    onChange(option.value);
    setOpen(false);
  };

  // Once the panel is in place: scrolled during the slide, the list could take the page with it.
  const scrollToSelected = (panel: HTMLElement) => {
    panel.querySelector("[role='option'][aria-selected='true']")?.scrollIntoView({ block: "center" });
  };

  return (
    <>
      <SettingsSelect
        id={id}
        label={label}
        tooltip={tooltip}
        value={value}
        onChange={onChange}
        options={options}
        onOpen={() => setOpen(true)}
      />
      <Dialog
        fullScreen
        open={open}
        onClose={() => setOpen(false)}
        // MUI closes the panel on Escape without `preventDefault`, and Chrome
        // then closes the whole popup too. Called before MUI's own handler.
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
          }
        }}
        aria-labelledby={titleId}
        slots={{ transition: Slide }}
        slotProps={{ transition: { direction: "up", onEntered: scrollToSelected } }}
      >
        <LanguagePanel
          titleId={titleId}
          label={label}
          value={value}
          options={options}
          onPick={pick}
          onClose={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
};

interface LanguagePanelProps {
  titleId: string;
  label: string;
  value: string;
  options: LanguageOption[];
  onPick: (option: LanguageOption) => void;
  onClose: () => void;
}

/** The panel's content, mounted for each opening: the search starts empty every time. */
const LanguagePanel: FC<LanguagePanelProps> = ({ titleId, label, value, options, onPick, onClose }) => {
  const { t, i18n } = useTranslation("settings");
  const { direction } = useTheme();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Not `autoFocus`: the dialog's focus trap would take the focus back to
  // itself when StrictMode mounts it a second time (in development).
  useLayoutEffect(() => {
    searchRef.current?.focus();
  }, []);

  const locale = toTag(i18n.language);

  // Without case or accents: "aleman" finds "Alemán". Only the Latin, Greek and
  // Cyrillic accents (U+0300–U+036F): Devanagari vowel signs and the Japanese
  // voicing mark are other marks that tell names apart. The case goes first:
  // Turkish lowers "İ" to "i" only with its dot.
  const found = useMemo(() => {
    const fold = (text: string) => text.toLocaleLowerCase(locale).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const search = fold(query.trim());
    if (!search) {
      return options;
    }
    // 0: a name starts with the search, 1: contains it, 2: neither. The sort keeps the alphabet within each.
    const rank = (option: LanguageOption) => {
      const names = [option.label, option.englishName ?? ""].map(fold);
      return names.some((name) => name.startsWith(search)) ? 0 : names.some((name) => name.includes(search)) ? 1 : 2;
    };
    return options
      .map((option) => ({ option, rank: rank(option) }))
      .filter((item) => item.rank < 2)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.option);
  }, [locale, options, query]);

  // The one language Tab reaches in the list; the arrows move between the rest.
  const tabStop = found.find((option) => option.value === value) ?? found[0];

  const focusOption = (index: number) => {
    (listRef.current?.children[index] as HTMLElement | undefined)?.focus();
  };

  const handleSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && found[0]) {
      event.preventDefault();
      onPick(found[0]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(0);
    }
  };

  // Two columns, filled row by row: up and down are two languages away.
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const previous = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    const steps: Record<string, number> = { [next]: 1, [previous]: -1, ArrowDown: 2, ArrowUp: -2 };
    const step = steps[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const index = [...event.currentTarget.children].indexOf(event.target as Element);
    if (event.key === "ArrowUp" && index < 2) {
      searchRef.current?.focus();
    } else {
      focusOption(index + step);
    }
  };

  const searchLabel = t("fields.languagePanel.search");
  const backLabel = t("fields.languagePanel.back");

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1, pt: 1 }}>
        <IconButton onClick={onClose} aria-label={backLabel} title={backLabel}>
          {/* Back is against the reading direction. */}
          <ArrowBackIcon sx={{ transform: direction === "rtl" ? "scaleX(-1)" : undefined }} />
        </IconButton>
        <Typography id={titleId} variant="h6" component="h2">{label}</Typography>
      </Stack>
      <Box sx={{ px: 2, py: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          inputRef={searchRef}
          placeholder={searchLabel}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          slotProps={{
            htmlInput: { "aria-label": searchLabel },
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            },
          }}
        />
      </Box>
      {/* `contain`: the end of the list does not scroll the page behind the panel. */}
      <Box sx={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", px: 1, pb: 2, borderTop: 1, borderColor: "divider" }}>
        {found.length === 0
          ? <Typography sx={{ p: 2 }} color="text.secondary">{t("fields.languagePanel.noResults")}</Typography>
          : (
            <Box
              ref={listRef}
              role="listbox"
              aria-label={label}
              onKeyDown={handleListKeyDown}
              sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", pt: 1 }}
            >
              {found.map((option) => {
                const selected = option.value === value;
                return (
                  // Hover, keyboard focus and the selected one are drawn by the theme, as in the menus.
                  <ListItemButton
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    selected={selected}
                    tabIndex={option === tabStop ? 0 : -1}
                    onClick={() => onPick(option)}
                    sx={{
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      textAlign: "start",
                      fontWeight: selected ? 600 : 400,
                      color: selected ? "primary.main" : "text.primary",
                    }}
                  >
                    <CheckIcon fontSize="small" sx={{ visibility: selected ? "visible" : "hidden" }} />
                    <Typography component="span" variant="body2" sx={{ fontWeight: "inherit" }}>
                      <OptionLabel item={option} />
                    </Typography>
                  </ListItemButton>
                );
              })}
            </Box>
          )}
      </Box>
    </>
  );
};
