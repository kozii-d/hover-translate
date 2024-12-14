import { FC, ReactNode, useCallback, useMemo, useState } from "react";
import { AuthenticationContext, type Session, SessionContext, } from "@toolpad/core/AppProvider";
import { RouterPath } from "@/app/config/routerPath.ts";
import { useNavigate } from "react-router";
import {
  getIdToken,
  getIdTokenFromStorage,
  removeIdTokenFromStorage,
  saveIdTokenToStorage
} from "@/shared/lib/helpers/idToken.ts";
import { api } from "@/shared/api/api.ts";
import { GoogleTokenPayload } from "@/shared/types/google.ts";
import { UserSessionContext } from "@/app/providers/AuthProvider/useUserSession.ts";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();

  const setUserSession = useCallback((idTokenPayload: GoogleTokenPayload) => {
    const user = {
      name: idTokenPayload.name,
      email: idTokenPayload.email,
      image: idTokenPayload.picture,
    };

    setSession({ user });
  }, []);

  const signIn = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);
    try {
      const idTokenData = await getIdToken({ interactive: true });

      await saveIdTokenToStorage(idTokenData);
      await api.post("/auth/login")
        .catch(() => removeIdTokenFromStorage());

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
        
        api.post("/auth/logout");
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
    };
  }, [signIn, signOut]);

  return (
    <AuthenticationContext.Provider value={authentication}>
      <SessionContext.Provider value={session}>
        <UserSessionContext.Provider value={{ session, setSession }}>
          {children}
        </UserSessionContext.Provider>
      </SessionContext.Provider>
    </AuthenticationContext.Provider>
  );
};