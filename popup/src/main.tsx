import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App.tsx";
import { HashRouter } from "react-router";
import "./app/config/i18n.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App/>
    </HashRouter>
  </StrictMode>,
);
