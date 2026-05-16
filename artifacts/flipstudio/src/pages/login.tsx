import { useState, useEffect } from "react";
  import { Watermark } from "@/components/watermark";
  import { useLocation } from "wouter";
  import { Eye, EyeOff, Loader2, Sparkles, User, Lock, Mail, ArrowRight, Film, X, ChevronRight } from "lucide-react";
  import { useAuth } from "@/lib/auth";
  import { useToast } from "@/hooks/use-toast";
  import { SUPABASE_ENABLED } from "@/lib/supabase";

  function PasswordStrength({ password }: { password: string }) {
    const score = [password.length >= 6, password.length >= 10, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
    const colors = ["bg-red-500","bg-orange-500","bg-yellow-500","bg-lime-500","bg-emerald-500"];
    const labels = ["Weak","Fair","Good","Strong","Excellent"];
    if (!password) return null;
    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex gap-1">{[...Array(5)].map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score - 1] : "bg-white/10"}`}/>)}</div>
        <p className="text-[10px] text-white/35">{labels[score - 1] ?? "Enter password"}</p>
      </div>
    );
  }

  interface GooglePickerProps { onConfirm: (email: string, name: string) => void; onCancel: () => void; }

  function GoogleAccountPicker({ onConfirm, onCancel }: GooglePickerProps) {
    const [step, setStep] = useState<"pick"|"enter">("pick");
    const [email, setEmail] = useState("");
    const [name,  setName]  = useState("");

    const handleContinue = () => {
      if (!email.trim()) return;
      const derived = email.split("@")[0] ?? "User";
      const displayName = name.trim() || (derived.charAt(0).toUpperCase() + derived.slice(1).replace(/[._]/g, " "));
      onConfirm(email.trim(), displayName);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md"
        onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className="w-full max-w-sm bg-[#1e1e2e] rounded-t-3xl pt-2 pb-8 px-0 shadow-2xl"
          style={{ animation: "slideUp .25s ease-out" }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"/>
          <div className="px-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-bold text-white/80">Sign in with Google</span>
              <button onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <h2 className="text-lg font-bold text-white">Choose an account</h2>
            <p className="text-sm text-white/45 mt-0.5">to continue to FlipStudio</p>
          </div>

          {step === "pick" && (
            <div className="px-2 pt-3">
              <button onClick={() => setStep("enter")}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/[0.06] transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-base font-bold text-white shrink-0">+</div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">Use another account</p>
                  <p className="text-xs text-white/40">Sign in with your Google account</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/25"/>
              </button>
            </div>
          )}

          {step === "enter" && (
            <div className="px-6 pt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">Gmail address</label>
                <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleContinue()}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 transition-all"
                  placeholder="yourname@gmail.com" autoComplete="email"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
                  Display name <span className="text-white/25 normal-case">(optional)</span>
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleContinue()}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/60 transition-all"
                  placeholder="Your Name" autoComplete="name"/>
              </div>
              <button onClick={handleContinue} disabled={!email.trim()}
                className="w-full h-12 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 rounded-xl font-semibold text-sm text-white transition-colors flex items-center justify-center gap-2">
                Continue <ChevronRight className="w-4 h-4"/>
              </button>
              <button onClick={() => setStep("pick")} className="w-full text-sm text-white/40 hover:text-white/70 transition-colors py-1">← Back</button>
            </div>
          )}
          <p className="text-center text-[11px] text-white/20 mt-5 px-6">Google will share your name, email, and profile picture with FlipStudio.</p>
        </div>
      </div>
    );
  }

  export default function LoginPage() {
    const [, setLocation] = useLocation();
    const { login, register, loginWithGoogle, hasAnyAccount } = useAuth();
    const { toast } = useToast();

    const [mode, setMode] = useState<"login"|"register">("login");
    const [email, setEmail]       = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw]     = useState(false);
    const [loading, setLoading]   = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [showGooglePicker, setShowGooglePicker] = useState(false);

    useEffect(() => {
      if (!SUPABASE_ENABLED && !hasAnyAccount()) setMode("register");
    }, [hasAnyAccount]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !password.trim()) { toast({ title: "Fill in all fields", variant: "destructive" }); return; }
      if (mode === "register" && !username.trim()) { toast({ title: "Choose a username", variant: "destructive" }); return; }
      setLoading(true);
      try {
        mode === "login" ? await login(email, password) : await register(email, username, password);
        setLocation("/");
      } catch (err) {
        toast({ title: mode === "login" ? "Sign-in failed" : "Registration failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
      } finally { setLoading(false); }
    };

    const handleGoogleOneTap = async () => {
      if (SUPABASE_ENABLED) { void loginWithGoogle(); return; }
      setGoogleLoading(true);
      try {
        // One-tap: no picker needed — auto-creates a local account instantly
        await loginWithGoogle();
        setLocation("/");
      } catch (err) {
        toast({ title: "Google sign-in failed", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
      } finally { setGoogleLoading(false); }
    };

    const handleGoogleConfirm = async (pickedEmail: string, pickedName: string) => {
      setShowGooglePicker(false);
      try { await loginWithGoogle(pickedEmail, pickedName); setLocation("/"); }
      catch (err) { toast({ title: "Google sign-in failed", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" }); }
    };

    const continueAsGuest = async () => {
      setGuestLoading(true);
      try {
        const guestId = Math.random().toString(36).slice(2, 8).toUpperCase();
        await register(`guest_${Date.now()}@flipstudio.local`, `Guest_${guestId}`, `guestpw_${Date.now()}`);
        setLocation("/");
      } catch (err) {
        toast({ title: "Could not start guest session", description: err instanceof Error ? err.message : "Please try again", variant: "destructive" });
      } finally { setGuestLoading(false); }
    };

    return (
      <div className="page-enter-up min-h-screen bg-[#060610] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="aurora-bg">
          <div className="aurora-blob aurora-blob-1"/><div className="aurora-blob aurora-blob-2"/><div className="aurora-blob aurora-blob-3"/>
        </div>
        <div className="relative w-full max-w-sm z-10 fade-in-scale">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-5">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-800 flex items-center justify-center shadow-2xl shadow-violet-900/60 glow-violet float">
                <Film className="w-10 h-10 text-white drop-shadow-lg"/>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-2.5 h-2.5 text-white"/>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-1 glow-text-violet">Flip<span className="gradient-text-violet">Studio</span></h1>
            <p className="text-sm text-white/40 font-medium">Professional Animation Studio</p>
            {!SUPABASE_ENABLED && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/> Offline Mode — data saved on device
              </div>
            )}
          </div>

          <div className="glass-panel rounded-3xl p-6">
            <div className="flex bg-white/5 rounded-2xl p-1 mb-5">
              {(["login","register"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${mode === m ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40" : "text-white/35 hover:text-white/70"}`}>
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><User className="w-3 h-3"/> Username</label>
                  <input value={username} onChange={e => setUsername(e.target.value)} required className="glass-input w-full px-4 py-3 text-sm rounded-xl" placeholder="your_username" autoComplete="username"/>
                </div>
              )}
              <div>
                <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Mail className="w-3 h-3"/> Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="glass-input w-full px-4 py-3 text-sm rounded-xl" placeholder="you@example.com" autoComplete="email"/>
              </div>
              <div>
                <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Lock className="w-3 h-3"/> Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    minLength={mode === "register" ? 4 : 1}
                    className="glass-input w-full px-4 py-3 pr-11 text-sm rounded-xl"
                    placeholder={mode === "register" ? "Min 4 characters" : "••••••••"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}/>
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
                {mode === "register" && <PasswordStrength password={password}/>}
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-12 mt-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.97] rounded-xl font-bold text-base text-white shadow-lg shadow-violet-900/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 press">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <>{mode === "login" ? "Sign In" : "Create Account"}<ArrowRight className="w-4 h-4"/></>}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/8"/><span className="text-xs text-white/20 font-medium">or continue with</span><div className="flex-1 h-px bg-white/8"/>
            </div>

            <button onClick={() => void handleGoogleOneTap()} disabled={googleLoading}
              className="w-full h-12 mb-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 border border-white/15 bg-white/8 hover:bg-white/12 active:scale-[0.97] transition-all text-white/90 press disabled:opacity-60">
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? "Signing in…" : "Continue with Google"}
            </button>

            <button onClick={continueAsGuest} disabled={guestLoading}
              className="glass-btn w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 press">
              {guestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5 text-violet-400"/>}
              Continue as Guest
            </button>
          </div>
          <p className="text-center text-xs text-white/18 mt-5">{SUPABASE_ENABLED ? "Your animations sync across all devices" : "All data stored locally — no internet needed"}</p>
        </div>

        {showGooglePicker && <GoogleAccountPicker onConfirm={handleGoogleConfirm} onCancel={() => setShowGooglePicker(false)}/>}
        <Watermark/>
      </div>
    );
  }
  