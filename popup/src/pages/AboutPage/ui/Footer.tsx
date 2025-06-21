import { FC } from "react";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { useTranslation } from "react-i18next";

export const Footer: FC = () => {
  const { t } = useTranslation("about");
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version;

  const openChangelog = () => {
    chrome.tabs.create({
      url: "https://github.com/kozii-d/hover-translate/blob/master/CHANGELOG.md"
    });
  };

  return (
    <Box>
      <Divider sx={{ marginInline: -2, mt: 2 }}/>
      <Box sx={{ mt: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {t("footer.version")} {version} ·{" "}
          <Link
            style={{ cursor: "pointer" }}
            onClick={openChangelog}
            underline="hover"
          >
            {t("footer.changelog")}
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};