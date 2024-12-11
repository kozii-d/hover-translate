import {useContext} from "react";
import {SessionContext} from "@toolpad/core/AppProvider";

export const useSession = () => {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("Session is not provided");
  }

  return session;
};