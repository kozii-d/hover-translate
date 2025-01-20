export const downloadFile = (data: string, fileName: string, fileType: "json" | "csv"): void => {
  const blob = new Blob([data], { type: fileType === "json" ? "application/json" : "text/csv" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.${fileType}`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};