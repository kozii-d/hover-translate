import { routeConfig } from "./config/routeConfig.ts";
import { RouterAppProvider } from "./providers/RouterAppProvider";
import { ThemeAppProvider } from "./providers/ThemeAppProvider";
import { NotificationProvider } from "./providers/NotificationProvider";
// import { AuthProvider } from "./providers/AuthProvider/AuthProvider.tsx";

function App() {
  return (
    <ThemeAppProvider>
      <NotificationProvider>
        {/*<AuthProvider>*/}
        <RouterAppProvider routes={routeConfig}/>
        {/*</AuthProvider>*/}
      </NotificationProvider>
      
    </ThemeAppProvider>
  );
}

export default App;