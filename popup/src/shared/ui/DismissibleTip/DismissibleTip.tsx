import { FC, ReactNode, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";

import { useStorage } from "@/shared/lib/hooks/useStorage.ts";

interface DismissibleTipProps {
  /**
   * The `sync` key set to `true` once the viewer closes the tip; absent means
   * "show". One key per tip rather than one object for all of them: an object
   * changed entry by entry needs a single writing context, and two open popup
   * pages are two. Not part of `settings`, so no migration is needed, and the
   * background never writes these keys.
   */
  storageKey: string;
  /** The accessible name of the close button. */
  closeText: string;
  children: ReactNode;
}

/** An info tip the viewer can close for good. */
export const DismissibleTip: FC<DismissibleTipProps> = ({ storageKey, closeText, children }) => {
  const { get, set } = useStorage();

  // Unknown until storage answers: showing the tip meanwhile would flash it at
  // every viewer who has already closed it.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    get<boolean>(storageKey, "sync")
      .then((value) => setDismissed(Boolean(value)))
      .catch((error) => {
        console.error(`Could not read whether the tip "${storageKey}" was closed`, error);
        setDismissed(false);
      });
  }, [get, storageKey]);

  if (dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    set(storageKey, true, "sync")
      .catch((error) => console.error(`Could not remember that the tip "${storageKey}" was closed`, error));
  };

  return (
    <Alert severity="info" onClose={dismiss} closeText={closeText}>
      {children}
    </Alert>
  );
};
