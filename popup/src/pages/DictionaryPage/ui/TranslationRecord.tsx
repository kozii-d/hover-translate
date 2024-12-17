import { Translation } from "../model/types/schema.ts";
import { FC } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";

interface TranslationRecordProps {
  translation: Translation;
  onRemove: (id: string) => void;
  isLast: boolean;
}
export const TranslationRecord: FC<TranslationRecordProps> = (props) => {
  const { translation, onRemove, isLast } = props;

  return (
    <Box sx={{ padding: "8px 0", borderBottom: isLast ? 0 : 1, borderColor: "divider", margin: "0 !important" }}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
      >
        <Typography variant="body1" sx={{ flex: 1 }}>
          {translation.originalText}
        </Typography>
        <Typography variant="body1" sx={{ flex: 1 }}>
          {translation.translatedText}
        </Typography>
        <IconButton aria-label="delete" onClick={() => onRemove(translation.id)}>
          <DeleteIcon />
        </IconButton>
      </Stack>
    </Box>
  );
};