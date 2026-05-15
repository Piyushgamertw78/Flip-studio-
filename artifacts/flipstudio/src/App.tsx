import { Switch, Route, Router as WouterRouter } from "wouter";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "@/components/ui/toaster";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { ThemeProvider } from "@/components/theme-provider";
  import { AuthProvider, useAuth } from "@/lib/auth";
  import NotFound from "@/pages/not-found";
  import Dashboard from "@/pages/dashboard";
  import NewProject from "@/pages/new-project";
  import Studio from "@/pages/studio";
  import ExportPage from "@/pages/export-page";
  import LoginPage from "@/pages/login";
  import Whiteboard from "@/pages/whiteboard";
  import SettingsPage from "@/pages/settings";

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });

  function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#050508]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-sm text-white/40">Loading FlipStudio…</p>
          </div>
        </div>
      );
    }

    if (!user) return <LoginPage />;
    return <>{children}</>;
  }

  function Router() {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/whiteboard" component={Whiteboard} />
        <Route path="/settings"><AuthGuard><SettingsPage /></AuthGuard></Route>
        <Route path="/projects/new"><AuthGuard><NewProject /></AuthGuard></Route>
        <Route path="/projects/:id/export"><AuthGuard><ExportPage /></AuthGuard></Route>
        <Route path="/projects/:id"><AuthGuard><Studio /></AuthGuard></Route>
        <Route path="/"><AuthGuard><Dashboard /></AuthGuard></Route>
        <Route component={NotFound} />
      </Switch>
    );
  }

  function App() {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TooltipProvider>
              <WouterRouter base={base}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  export default App;
  