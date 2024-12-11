import {FC, ReactNode, useCallback, useEffect, useMemo, useState} from "react";
import {AuthenticationContext, type Session, SessionContext,} from '@toolpad/core/AppProvider';
import {RouterPath} from "@/app/config/routerPath.ts";
import {useNavigate} from "react-router";
import {PageSkeleton} from "@/shared/ui/Skeletons/PageSkeleton.tsx";
import {jwtDecode} from "jwt-decode";
import {
  checkIsTokenExpired,
  getIdToken,
  getIdTokenFromStorage, removeIdTokenFromStorage, restoreToken,
  saveIdTokenToStorage
} from "@/shared/lib/helpers/idToken.ts";
import {authApi} from "@/shared/api/api.ts";
import {GoogleTokenPayload} from "@/shared/types/google.ts";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const navigate = useNavigate();

  const setUserSession = useCallback((idTokenPayload: GoogleTokenPayload) => {
    const user = {
      name: idTokenPayload.name,
      email: idTokenPayload.email,
      image: idTokenPayload.picture,
    };

    setSession({user});
  }, []);

  const signIn = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);
    try {
      const idTokenData = await getIdToken({ interactive: true });

      await authApi.post("/login", { idToken: idTokenData.idToken });

      await saveIdTokenToStorage(idTokenData);
      setUserSession(idTokenData.idTokenPayload);
      navigate(RouterPath.settings);
    } catch (error) {
      console.error("Sign-in failed:", error);
    } finally {
      setAuthLoading(false);
    }
  }, [authLoading, navigate, setUserSession]);

  const signOut = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);

    try {
      const idTokenData = await getIdTokenFromStorage();

      if (idTokenData) {
        await authApi.post("/logout", { idToken: idTokenData.idToken });
        await removeIdTokenFromStorage();
      }
      setSession(null);
      navigate(RouterPath.login);
    } catch (error) {
      console.error("Sign-out failed:", error);
    } finally {
      setAuthLoading(false);
    }
  }, [authLoading, navigate]);

  const authentication = useMemo(() => {
    return {
      signIn,
      signOut,
    }
  }, [signIn, signOut]);

  useEffect(() => {
    const checkToken = async () => {
      setUserLoading(true);
      try {
        const idTokenData = await getIdTokenFromStorage();

        if (!idTokenData || !idTokenData.idToken) {
          return restoreToken();
        }

        const idTokenPayload = jwtDecode<GoogleTokenPayload>(idTokenData.idToken);
        if (checkIsTokenExpired(idTokenPayload.exp)) {
          return restoreToken();
        }
        setUserSession(idTokenPayload);
      } catch (error) {
        console.error("Failed to check token:", error);
        restoreToken();
      } finally {
        setUserLoading(false);
      }
    };

    checkToken();
  }, [setUserSession]);

  if (userLoading) {
    return (
      <PageSkeleton/>
    )
  }

  return (
    <AuthenticationContext.Provider value={authentication}>
      <SessionContext.Provider value={session}>
        {children}
      </SessionContext.Provider>
    </AuthenticationContext.Provider>
  );
};