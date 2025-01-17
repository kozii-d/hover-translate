import { FC } from "react";
import { SignInPage, type AuthProvider } from "@toolpad/core/SignInPage";

import { useAuth } from "@/app/providers/AuthProvider/useAuth.ts";

const providers: AuthProvider[] = [
  { id: "google", name: "Google" },
];

const LoginPage: FC = () => {
  const auth = useAuth();

  return (
    <SignInPage
      signIn={auth.signIn}
      providers={providers}
      sx={{ paddingTop: "60px", paddingBottom: "60px" }}
    />
  );
};

export default LoginPage;