import { routeConfig } from "./config/routeConfig.ts";
import { RouterAppProvider } from "./providers/RouterAppProvider";
import { ThemeAppProvider } from "./providers/ThemeAppProvider";

function App() {
  return (
    <ThemeAppProvider>
      <RouterAppProvider routes={routeConfig}/>
    </ThemeAppProvider>
  );
}

export default App;