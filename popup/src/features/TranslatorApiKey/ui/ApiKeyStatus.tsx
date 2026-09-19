import { FC, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { getApiKeyProvider } from "@extension/common/translators/apiKeyProviders.ts";
import { ApiKeyUsage } from "@extension/common/types/apiKeys.ts";
import { requestApiKeyUsage } from "@/shared/lib/helpers/translatorRequests.ts";
import { describeTranslatorError } from "@/shared/lib/helpers/translatorErrors.ts";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";

/** From here on the bar turns orange: the viewer should know before it runs out. */
const USAGE_WARNING_RATIO = 0.9;

interface ApiKeyStatusProps {
  translatorKey: string;
  translatorName: string;
  fallbackTranslatorName: string;
  apiKey: string;
  onChangeKey: () => void;
  onRemoveKey: () => void;
}

type UsageState =
  | { status: "loading" }
  | { status: "loaded"; usage: ApiKeyUsage }
  | { status: "failed"; message: string };

/**
 * The popup's languages are named after the `_locales` folders (`zh_CN`,
 * `pt_BR`), which `Intl` rejects with a RangeError that took the whole popup
 * down. Formatting falls back to the browser's own locale rather than fail.
 */
const formatCount = (value: number, language: string) => {
  try {
    return value.toLocaleString(language.replace(/_/g, "-"));
  } catch {
    return value.toLocaleString();
  }
};

/** Enough of the key to recognise it, not enough to use it. */
const maskApiKey = (apiKey: string) => {
  const suffix = apiKey.includes(":") ? apiKey.slice(apiKey.lastIndexOf(":")) : "";
  const body = suffix ? apiKey.slice(0, -suffix.length) : apiKey;

  return `••••${body.slice(-4)}${suffix}`;
};

export const ApiKeyStatus: FC<ApiKeyStatusProps> = ({
  translatorKey,
  translatorName,
  fallbackTranslatorName,
  apiKey,
  onChangeKey,
  onRemoveKey,
}) => {
  const { t, i18n } = useTranslation("settings");
  const [usageState, setUsageState] = useState<UsageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setUsageState({ status: "loading" });

    requestApiKeyUsage(translatorKey)
      .then((usage) => {
        if (!cancelled) setUsageState({ status: "loaded", usage });
      })
      .catch((error: unknown) => {
        console.warn(`Could not load the ${translatorName} usage`, error);
        if (cancelled) return;

        setUsageState({
          status: "failed",
          message: describeTranslatorError(t, error, translatorName)
            ?? (error instanceof Error ? error.message : String(error)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, t, translatorKey, translatorName]);

  const plan = getApiKeyProvider(translatorKey)?.getPlan?.(apiKey);
  const formatNumber = (value: number) => formatCount(value, i18n.language);

  const renderUsage = () => {
    if (usageState.status === "loading") {
      return <Skeleton variant="rounded" height={30} />;
    }

    if (usageState.status === "failed") {
      return (
        <Typography variant="body2" color="warning.main">
          {t("apiKey.usage.unavailable", { reason: usageState.message })}
        </Typography>
      );
    }

    const { characterCount, characterLimit } = usageState.usage;
    // A limit of 0 would mean "no limit reported"; there is nothing to draw.
    if (!characterLimit) return null;

    const ratio = Math.min(characterCount / characterLimit, 1);
    const exhausted = characterCount >= characterLimit;

    return (
      <Stack spacing={0.5}>
        <LinearProgress
          variant="determinate"
          value={ratio * 100}
          color={exhausted ? "error" : ratio >= USAGE_WARNING_RATIO ? "warning" : "primary"}
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" color="text.secondary">
          {t("apiKey.usage.label", {
            used: formatNumber(characterCount),
            limit: formatNumber(characterLimit),
          })}
        </Typography>
        {exhausted && (
          <Typography variant="caption" color="error">
            {t("apiKey.usage.exhausted", { translatorName })}
          </Typography>
        )}
      </Stack>
    );
  };

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <CheckCircleIcon color="success" fontSize="small" />
          <Typography variant="subtitle2">
            {t("apiKey.status.connected", { translatorName })}
          </Typography>
          {plan && (
            <Chip size="small" variant="outlined" label={t(`apiKey.status.plan.${plan}`)} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
          {maskApiKey(apiKey)}
        </Typography>
        {renderUsage()}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <ConfirmationModal
            trigger={(
              <Button size="small" color="error">
                {t("apiKey.actions.remove")}
              </Button>
            )}
            title={t("apiKey.modals.remove.title", { translatorName })}
            description={t("apiKey.modals.remove.description", { fallbackTranslatorName })}
            actionText={t("apiKey.modals.remove.action")}
            onConfirm={onRemoveKey}
          />
          <Button size="small" variant="outlined" onClick={onChangeKey}>
            {t("apiKey.actions.change")}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
