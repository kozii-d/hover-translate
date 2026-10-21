import { WelcomePage } from "@/pages/WelcomePage";
import { ThemeAppProvider } from "./providers/ThemeAppProvider";

/** The page opened on install (`welcome.html`): the popup's theme and language, no router. */
export function WelcomeApp() {
  return (
    <ThemeAppProvider>
      <WelcomePage/>
    </ThemeAppProvider>
  );
}
