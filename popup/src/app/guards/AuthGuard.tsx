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

const MAX_ATTEMPT_COUNT = 3;

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const [userLoading, setUserLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
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
          if (attemptCount < MAX_ATTEMPT_COUNT) {
            await restoreToken();
            return setAttemptCount((prev) => prev + 1);
          } else {
            return navigate(RouterPath.login);
          }
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
        if (attemptCount < MAX_ATTEMPT_COUNT) {
          await restoreToken();
          setAttemptCount((prev) => prev + 1);
          return;
        } else {
          navigate(RouterPath.login);
        }
        console.error("Failed to check token:", error);
      } finally {
        setUserLoading(false);
      }
    };

    checkToken();
  }, [attemptCount, navigate, setSession]);

  if (!isAuth || userLoading) {
    return (
      <PageSkeleton/>
    );
  }
  return children;
};