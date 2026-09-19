import { FC, KeyboardEvent, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTranslation } from "react-i18next";
import { getApiKeyProvider } from "@extension/common/translators/apiKeyProviders.ts";
import { ConfirmationModal } from "@/shared/ui/ConfirmationModal/ConfirmationModal.tsx";

interface ApiKeyFormProps {
  translatorKey: string;
  translatorName: string;
  /** Filled in when the form comes back after the popup was closed mid-way. */
  initialApiKey?: string;
  /** Why the form was opened, when it was not the viewer's own choice. */
  initialError?: string | null;
  /**
   * Checks and saves the key. Rejects with a message ready to show under the
   * field. Called synchronously from the submit event, so it may start a
   * permission request.
   */
  onConnect: (apiKey: string) => Promise<void>;
  onCancel: () => void;
  /** Offered when a key is already stored — one that stopped working included. */
  onRemove?: () => void;
  /** What removing the stored key will do, for the confirmation. */
  removeDescription?: string;
}

export const ApiKeyForm: FC<ApiKeyFormProps> = ({
  translatorKey,
  translatorName,
  initialApiKey = "",
  initialError = null,
  onConnect,
  onCancel,
  onRemove,
  removeDescription = "",
}) => {
  const { t } = useTranslation("settings");

  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [connecting, setConnecting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  const provider = getApiKeyProvider(translatorKey);

  // Not a <form>: this sits inside the settings form, and forms cannot nest.
  // Enter in the field and the button both end up here, each within the user
  // gesture a permission prompt needs.
  const handleSubmit = () => {
    if (connecting) return;

    const trimmedApiKey = apiKey.trim();

    if (!trimmedApiKey) {
      setError(t("apiKey.errors.empty"));
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setConnecting(true);

    // No `await` before this call: it has to run inside the submit event for
    // the browser to show a permission prompt.
    onConnect(trimmedApiKey)
      .then(() => setConnecting(false))
      .catch((connectError: unknown) => {
        setConnecting(false);
        setError(connectError instanceof Error ? connectError.message : String(connectError));
        // The field is still disabled until this render lands.
        requestAnimationFrame(() => inputRef.current?.focus());
      });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box
      sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}
    >
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          {t("apiKey.title", { translatorName })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("apiKey.description", { translatorName })}
        </Typography>
        {provider?.signupUrl && (
          <Link
            href={provider.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start" }}
          >
            {t("apiKey.getKey", { translatorName })}
            <OpenInNewIcon fontSize="inherit" />
          </Link>
        )}
        <TextField
          inputRef={inputRef}
          label={t("apiKey.field.label")}
          placeholder={t("apiKey.field.placeholder")}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          type={showApiKey ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          autoFocus={!initialApiKey}
          fullWidth
          size="small"
          disabled={connecting}
          error={Boolean(error)}
          helperText={error || t("apiKey.privacy", { translatorName })}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => setShowApiKey((shown) => !shown)}
                    title={showApiKey ? t("apiKey.field.hide") : t("apiKey.field.show")}
                    aria-label={showApiKey ? t("apiKey.field.hide") : t("apiKey.field.show")}
                  >
                    {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {onRemove && (
            <Box sx={{ mr: "auto !important" }}>
              <ConfirmationModal
                trigger={(
                  <Button size="small" color="error" disabled={connecting}>
                    {t("apiKey.actions.remove")}
                  </Button>
                )}
                title={t("apiKey.modals.remove.title", { translatorName })}
                description={removeDescription}
                actionText={t("apiKey.modals.remove.action")}
                onConfirm={onRemove}
              />
            </Box>
          )}
          <Button size="small" onClick={onCancel} disabled={connecting}>
            {t("apiKey.actions.cancel")}
          </Button>
          <Button
            size="small"
            onClick={handleSubmit}
            variant="contained"
            disabled={connecting}
            startIcon={connecting ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {connecting ? t("apiKey.actions.connecting") : t("apiKey.actions.connect")}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
