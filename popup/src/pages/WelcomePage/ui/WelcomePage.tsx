import { FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import GlobalStyles from "@mui/material/GlobalStyles";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { ErrorState } from "@/shared/ui/ErrorState/ErrorState.tsx";
import { YouTubeAccessAlert, useYouTubeAccess } from "@/features/YouTubeAccess";
import { LangSelector } from "@/widgets/LangSelector";
import { ThemeToggle } from "@/widgets/ThemeToggle";
import { useTargetLanguage } from "../model/useTargetLanguage.ts";
import { useIconOnToolbar } from "../model/useIconOnToolbar.ts";
import { TargetLanguageField } from "./TargetLanguageField.tsx";
import { DemoLanguage, DemoPlayer } from "./DemoPlayer.tsx";
import { DeepLCard } from "./DeepLCard.tsx";
import { PopupTabsCard } from "./PopupTabsCard.tsx";

const YOUTUBE_URL = "https://www.youtube.com/";

/** `en`, `en-GB`… */
const isEnglish = (code: string) => /^en(-|$)/i.test(code);

const List: FC<{ items: string[] }> = ({ items }) => (
  <Box component="ul" sx={{ m: 0, pl: 3 }}>
    {items.map((item) => (
      <Typography component="li" key={item} sx={{ mt: 0.5 }}>{item}</Typography>
    ))}
  </Box>
);

/**
 * Opened in a tab once, on install (`SettingsService`): the language to
 * translate into, access to YouTube if it is missing, the extension at work on
 * a demo player, and the way to YouTube; the popup's theme and language
 * buttons. No other settings: they are in the popup.
 */
export const WelcomePage: FC = () => {
  const { t } = useTranslation("welcome");
  const { state, load, save } = useTargetLanguage();
  const { hasAccess, requestAccess } = useYouTubeAccess();
  const iconOnToolbar = useIconOnToolbar();

  useEffect(() => {
    document.title = t("pageTitle");
  }, [t]);

  // Translated into English, the line to point at is the Spanish one.
  const demoLanguage: DemoLanguage | null = state.status === "loading"
    ? null
    : state.status === "ready" && isEnglish(state.settings.targetLanguageCode) ? "es" : "en";

  return (
    <Box component="main" sx={{ maxWidth: 720, mx: "auto", px: 2, py: { xs: 3, sm: 5 } }}>
      {/* YouTube's: the content script puts its tooltip and notification in
          the body, and the captions are in the page, where all of them take
          the body's line height and letter spacing (MUI's are 1.5 and 0.15 px).
          The page's own text sets both through the typography. */}
      <GlobalStyles styles={{ body: { lineHeight: "normal", letterSpacing: "normal" } }}/>
      <Stack spacing={4}>
        {/* The popup's own buttons, with its storage: a theme or language
            picked here is the popup's too, and the other way round. */}
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          {/* A long word in a narrow window (fi "HoverTranslatea" at 360 px)
              breaks rather than pushing the buttons out. Korean breaks
              between words, not inside them (`<html lang>` is the page's
              language); Japanese and Chinese have no spaces and break anywhere. */}
          <Typography
            variant="h4"
            component="h1"
            sx={{
              minWidth: 0,
              overflowWrap: "anywhere",
              fontSize: { xs: "1.75rem", sm: "2.125rem" },
              "&:lang(ko)": { wordBreak: "keep-all" },
            }}
          >
            {t("pageTitle")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flex: "none" }}>
            <ThemeToggle/>
            <LangSelector/>
          </Stack>
        </Stack>

        <Stack spacing={1}>
          {state.status === "failed" ? <ErrorState onRetry={load}/> : state.status === "ready" ? (
            <TargetLanguageField settings={state.settings} languages={state.languages} onChange={save}/>
          ) : <Skeleton variant="rounded" height={56}/>}
          <Typography variant="body2" color="text.secondary">{t("language.hint")}</Typography>
        </Stack>

        {hasAccess === false && <YouTubeAccessAlert onAllow={requestAccess}/>}

        <Stack spacing={2}>
          <List items={[t("try.hover"), t("try.shift"), t("try.click")]}/>
          <DemoPlayer language={demoLanguage}/>
        </Stack>

        {/* About switching to DeepL: not for a viewer on it already. */}
        {!(state.status === "ready" && state.settings.translator === "deepl") && <DeepLCard/>}

        <PopupTabsCard/>

        {/* The tips first: the button leaves the page, in this tab. */}
        <Stack spacing={2} alignItems="flex-start">
          {/* The tip to pin the icon, only while it is known not to be pinned. */}
          <List items={iconOnToolbar === false ? [t("start.captions"), t("start.pin")] : [t("start.captions")]}/>
          <Button variant="contained" size="large" href={YOUTUBE_URL} startIcon={<YouTubeIcon/>}>
            {t("start.openYouTube")}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
