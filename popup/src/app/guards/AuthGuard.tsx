import { ReactNode, useEffect, useState } from "react";
import { checkIsTokenExpired, getIdTokenFromStorage, restoreToken } from "@/shared/lib/helpers/idToken.ts";
import { RouterPath } from "@/app/config/routerPath.ts";
import { jwtDecode } from "jwt-decode";
import { GoogleTokenPayload } from "@/shared/types/google.ts";
import { PageSkeleton } from "@/shared/ui/Skeletons/PageSkeleton.tsx";
import { useNavigate } from "react-router";
import { useUserSession } from "@/app/providers/AuthProvider/useUserSession.ts";

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const [userLoading, setUserLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useUserSession();

  useEffect(() => {
    const checkToken = async () => {
      setUserLoading(true);
      try {
        const idTokenData = await getIdTokenFromStorage();
        if (!idTokenData || !idTokenData.idToken) {
          return navigate(RouterPath.login);
        }

        const idTokenPayload = jwtDecode<GoogleTokenPayload>(idTokenData.idToken);
        if (checkIsTokenExpired(idTokenPayload.exp)) {
          return restoreToken();
        }

        setSession({
          user: {
            name: idTokenPayload.name,
            email: idTokenPayload.email,
            image: idTokenPayload.picture,
          }
        });
        setIsAuth(true);
      } catch (error) {
        console.error("Failed to check token:", error);
        restoreToken();
      } finally {
        setUserLoading(false);
      }
    };

    checkToken();
  }, [navigate, setSession]);

  if (!isAuth || userLoading) {
    return (
      <PageSkeleton/>
    );
  }
  return children;
};