import { FC } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useTranslation } from "react-i18next";

export const Contacts: FC = () => {
  const { t } = useTranslation("about");

  const openGithubProjectPage = () => {
    chrome.tabs.create({
      url: "https://github.com/kozii-d/hover-translate",
    });
  };

  const openGithubIssuesPage = () => {
    chrome.tabs.create({
      url: "https://github.com/kozii-d/hover-translate/issues",
    });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom textTransform="uppercase" fontWeight="bold">
        {t("blocks.contacts.title")}
      </Typography>
      <List>
        <ListItemButton
          component="a"
          href="mailto:hovertranslate@gmail.com"
        >
          <ListItemIcon>
            <EmailIcon />
          </ListItemIcon>
          <ListItemText primary="hovertranslate@gmail.com" />
        </ListItemButton>

        <ListItemButton onClick={openGithubProjectPage}>
          <ListItemIcon>
            <GitHubIcon />
          </ListItemIcon>
          <ListItemText primary={t("blocks.contacts.github")} />
        </ListItemButton>

        <ListItemButton onClick={openGithubIssuesPage}>
          <ListItemIcon>
            <BugReportIcon />
          </ListItemIcon>
          <ListItemText primary={t("blocks.contacts.reportIssues")} />
        </ListItemButton>
      </List>
    </Box>
  );
};