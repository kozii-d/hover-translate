import {useContext} from "react";
import {AuthenticationContext} from "@toolpad/core/AppProvider";

export const useAuth = () => {
  const authentication = useContext(AuthenticationContext);

  if (!authentication) {
    throw new Error("AuthenticationContext is not provided");
  }

  return authentication;
};