import FileDownloadIcon from "@mui/icons-material/FileDownload";
import IconButton from "@mui/material/IconButton";
import { Fragment, useState, MouseEvent, FC } from "react";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import { downloadFile } from "@/shared/lib/helpers/downloadFiles.ts";
import { getCSVToExport, getJSONToExport } from "../lib/helpers/getFormattedData.ts";
import { generateShortHash } from "@/shared/lib/helpers/generateShortHash.ts";
import { useNotifications } from "@toolpad/core/useNotifications";

export const ExportData: FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const { t } = useTranslation("dictionary");

  const notifications = useNotifications();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const getFileName = async (data: string) => {
    try {
      const hash = await generateShortHash(data);
      return `hover-translate-dictionary-${hash}`;
    } catch (error) {
      const errorMessage = "Failed to generate file name";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
      return `hover-translate-dictionary-${Date.now()}`;
    }
  };

  const exportJSON = async () => {
    try {
      const jsonString = await getJSONToExport();
      const fileName = await getFileName(jsonString);

      await downloadFile(jsonString, fileName, "json");
      handleClose();
    } catch (error) {
      const errorMessage = "Failed to export JSON data";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    }
  };

  const exportCSV = async () => {
    try {
      const csvString = await getCSVToExport();
      const fileName = await getFileName(csvString);

      await downloadFile(csvString, fileName, "csv");
      handleClose();
    } catch (error) {
      const errorMessage = "Failed to export CSV data";
      notifications.show(errorMessage, { severity: "error", autoHideDuration: 5000 });
      console.error(errorMessage, error);
    }
  };

  return (
    <Fragment>
      <IconButton onClick={handleClick} title={t("actions.export.tooltip")}>
        <FileDownloadIcon />
      </IconButton>
      <Menu
        id="export-data-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem
          onClick={exportJSON}
          title={t("actions.exportJSON.tooltip")}
        >
          {t("actions.exportJSON.text")}
        </MenuItem>
        <MenuItem
          onClick={exportCSV}
          title={t("actions.exportCSV.tooltip")}
        >
          {t("actions.exportCSV.text")}
        </MenuItem>
      </Menu>
    </Fragment>
  );
};