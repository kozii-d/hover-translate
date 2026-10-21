import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WelcomeApp } from "./app/WelcomeApp.tsx";
import "./app/config/i18n.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WelcomeApp/>
  </StrictMode>,
);
