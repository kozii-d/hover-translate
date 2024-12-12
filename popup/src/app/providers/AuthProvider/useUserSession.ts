import { createContext, useContext } from "react";
import { Session } from "@toolpad/core/AppProvider";

interface UserSessionContextType {
  session: Session | null;
  setSession: (session: Session | null) => void;
}
export const UserSessionContext = createContext<UserSessionContextType>({ session: null, setSession: () => {} });

export const useUserSession = () => {
  const userSession = useContext(UserSessionContext);

  if (!userSession) {
    throw new Error("Session is not provided");
  }

  return userSession;
};