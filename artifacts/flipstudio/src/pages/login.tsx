import { useState, useEffect } from "react";
import { Watermark } from "@/components/watermark";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Sparkles, User, Lock, Mail, ArrowRight, Film } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_ENABLED } from "@/lib/supabase";

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"];
  const labels = ["Weak", "Fair", "Good", "Strong", "Excellent"];

  if (!password) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : "bg-white/10"}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-white/35">{labels[score - 1] ?? "Enter password"}</p>
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register, loginWithGoogle, hasAnyAccount } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!SUPABASE_ENABLED && !hasAnyAccount()) {
      setMode("register");
    }
  }, [hasAnyAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    if (mode === "register" && !username.trim()) {
      toast({ title: "Choose a username", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      setLocation("/");
    } catch (err) {
      toast({
        title: mode === "login" ? "Sign-in failed" : "Registration failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      setLocation("/");
    } catch (err) {
      toast({
        title: "Google sign-in failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setGuestLoading(true);
    try {
      const guestId    = Math.random().toString(36).slice(2, 8).toUpperCase();
      const guestEmail = `guest_${Date.now()}@flipstudio.local`;
      const guestPw    = `guestpw_${Date.now()}`;
      await register(guestEmail, `Guest_${guestId}`, guestPw);
      setLocation("/");
    } catch (err) {
      toast({
        title: "Could not start guest session",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060610] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Aurora background */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1"/>
        <div className="aurora-blob aurora-blob-2"/>
        <div className="aurora-blob aurora-blob-3"/>
      </div>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      <div className="relative w-full max-w-sm z-10 fade-in-scale">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-800
              flex items-center justify-center shadow-2xl shadow-violet-900/60 glow-violet float">
              <Film className="w-10 h-10 text-white drop-shadow-lg" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white mb-1 glow-text-violet">
            Flip<span className="gradient-text-violet">Studio</span>
          </h1>
          <p className="text-sm text-white/40 font-medium">Professional Animation Studio</p>

          {!SUPABASE_ENABLED && (
            <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-400/80 bg-amber-500/10
              border border-amber-500/20 rounded-full px-3 py-1 mt-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>
              Offline Mode — data saved on device
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="glass-panel rounded-3xl p-6">
          {/* Tab switcher */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-5">
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  mode === m
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40"
                    : "text-white/35 hover:text-white/70"
                }`}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Info banner for new users */}
          {mode === "register" && !SUPABASE_ENABLED && (
            <div className="glass rounded-2xl p-3 mb-4 border-violet-500/20">
              <p className="text-[11px] text-violet-300/80 text-center leading-relaxed">
                Create a free local account to save your animations on this device.
              </p>
            </div>
          )}

          {mode === "login" && !SUPABASE_ENABLED && !hasAnyAccount() && (
            <div className="glass rounded-2xl p-3 mb-4 border-amber-500/20">
              <p className="text-[11px] text-amber-300/80 text-center leading-relaxed">
                No accounts found. Switch to <button className="text-amber-300 underline font-semibold" onClick={() => setMode("register")}>Sign Up</button> to create one, or use Guest mode below.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3 h-3"/> Username
                </label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="glass-input w-full px-4 py-3 text-sm rounded-xl"
                  placeholder="your_username"
                  autoComplete="username"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3"/> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="glass-input w-full px-4 py-3 text-sm rounded-xl"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3"/> Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === "register" ? 4 : 1}
                  className="glass-input w-full px-4 py-3 pr-11 text-sm rounded-xl"
                  placeholder={mode === "register" ? "Min 4 characters" : "••••••••"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              {mode === "register" && <PasswordStrength password={password} />}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-1 bg-gradient-to-r from-violet-600 to-fuchsia-600
                hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.97]
                rounded-xl font-bold text-base text-white shadow-lg shadow-violet-900/40
                transition-all duration-200 flex items-center justify-center gap-2
                disabled:opacity-60 disabled:cursor-not-allowed press">
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin"/>
                : <>
                    {mode === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-4 h-4"/>
                  </>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-xs text-white/20 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={continueWithGoogle}
            disabled={googleLoading}
            className="w-full h-12 mb-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-3
              border border-white/15 bg-white/8 hover:bg-white/12 active:scale-[0.97]
              transition-all duration-200 text-white/90 disabled:opacity-60 press">
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin"/>
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Guest button */}
          <button
            onClick={continueAsGuest}
            disabled={guestLoading}
            className="glass-btn w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 press">
            {guestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5 text-violet-400"/>}
            Continue as Guest
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/18 mt-5 leading-relaxed">
          {SUPABASE_ENABLED
            ? "Your animations sync across all devices"
            : "All data stored locally — no internet needed"}
        </p>

        <p className="text-center text-[10px] text-white/12 mt-2">
          FlipStudio v2.0 · Made with passion
        </p>
      </div>
      <Watermark />
    </div>
  );
}
