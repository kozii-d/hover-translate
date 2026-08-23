export const downloadFile = (data: string, fileName: string, fileType: "json" | "csv"): void => {
  const blob = new Blob([data], { type: fileType === "json" ? "application/json" : "text/csv" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.${fileType}`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);

  // Revoking straight after `click()` sometimes cancels the download in Firefox:
  // the click only queues the save, and the URL has to still resolve when it
  // actually runs. One turn of the event loop is enough, and the blob is freed
  // either way.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
