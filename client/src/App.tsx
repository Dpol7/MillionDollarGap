import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import HomeV2 from "@/pages/home-v2";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/v2" component={HomeV2} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const publishableKey = publishableKeyFromHost(
    window.location.hostname,
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  );
  const proxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      proxyUrl={proxyUrl}
      appearance={{
        theme: dark,
        variables: {
          colorPrimary: "#f7931a",
          colorBackground: "#0e1012",
          colorForeground: "#f2f0eb",
          colorInput: "#14171a",
          colorInputForeground: "#f2f0eb",
          colorMutedForeground: "#8a9097",
          borderRadius: "0px",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
