import React from "react";
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

// ── Error Boundary — catches any React render error so the app never hard-crashes ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message ?? "Unknown error" };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[FlipStudio] Uncaught error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="h-screen w-screen flex flex-col items-center justify-center gap-6 p-8"
          style={{ background: "linear-gradient(135deg,#200d45,#0d0d2b,#0b1530)" }}
        >
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.2)" }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div className="text-center max-w-xs">
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
              {this.state.message || "An unexpected error occurred. Your work is auto-saved."}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.href = "/";
            }}
            className="px-8 py-3 font-bold text-white rounded-2xl transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
          >
            Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#200d45,#0d0d2b,#0b1530)" }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)" }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
            </svg>
          </div>
          <div className="w-8 h-8 rounded-full border-4 border-violet-500 animate-spin"
            style={{ borderTopColor: "transparent" }}/>
          <p className="font-semibold" style={{ color: "#c4b5fd" }}>Loading FlipStudio…</p>
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TooltipProvider>
              <WouterRouter base={base}>
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
