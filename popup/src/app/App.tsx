import {routeConfig} from "./config/routeConfig.ts";
import {RouterAppProvider} from "./providers/RouterAppProvider/RouterAppProvider.tsx";
import {ThemeAppProvider} from "./providers/ThemeAppProvider/ThemeAppProvider.tsx";

function App() {
    return (
      <ThemeAppProvider>
          <RouterAppProvider routes={routeConfig}/>
      </ThemeAppProvider>
    );
}

export default App;