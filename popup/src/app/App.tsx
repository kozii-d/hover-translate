import { routeConfig } from "./config/routeConfig.ts";
import { RouterAppProvider } from "./providers/RouterAppProvider/RouterAppProvider.tsx";
import { ThemeAppProvider } from "./providers/ThemeAppProvider/ThemeAppProvider.tsx";
// import { AuthProvider } from "./providers/AuthProvider/AuthProvider.tsx";

function App() {
  return (
    <ThemeAppProvider>
      {/*<AuthProvider>*/}
      <RouterAppProvider routes={routeConfig}/>
      {/*</AuthProvider>*/}
    </ThemeAppProvider>
  );
}

export default App;