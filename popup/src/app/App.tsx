import { routeConfig } from "./config/routeConfig.ts";
import { RouterAppProvider } from "./providers/RouterAppProvider";
import { ThemeAppProvider } from "./providers/ThemeAppProvider";
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