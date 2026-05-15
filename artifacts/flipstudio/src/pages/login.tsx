import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SUPABASE_ENABLED } from "@/lib/supabase";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      setLocation("/");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setLoading(true);
    try {
      // Always create a unique guest account in local mode — no Supabase needed
      const guestId   = Math.random().toString(36).slice(2, 8).toUpperCase();
      const guestEmail = `guest_${Date.now()}@flipstudio.local`;
      const guestPw    = `guestpw_${Date.now()}`;
      await register(guestEmail, `Guest_${guestId}`, guestPw);
      setLocation("/");
    } catch (err) {
      toast({
        title: "Could not create guest session",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080811] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl"/>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-fuchsia-600/8 blur-3xl"/>
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-2xl shadow-violet-900/50 mb-4">
            <svg width="40" height="40" viewBox="0 0 100 100">
              <rect x="8" y="28" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="8" y="42" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="8" y="56" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="83" y="28" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="83" y="42" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="83" y="56" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
              <rect x="22" y="18" width="56" height="64" rx="4" fill="rgba(0,0,0,0.3)"/>
              <rect x="27" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.9)"/>
              <rect x="53" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.2)"/>
              <rect x="27" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.2)"/>
              <rect x="53" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.2)"/>
              <line x1="31" y1="35" x2="42" y2="27" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <polygon points="42,27 44,31 40,32" fill="white"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">FlipStudio</h1>
          <p className="text-sm text-white/40 mt-1">Professional Animation Studio</p>
          {!SUPABASE_ENABLED && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 mt-2">
              Offline Mode — data saved locally
            </span>
          )}
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 backdrop-blur-sm">
          {/* Tab switcher */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-5">
            {(["login","register"] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode===m?"bg-violet-600 text-white shadow-lg":"text-white/40 hover:text-white"}`}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-xs text-white/50 font-medium mb-1 block">Username</label>
                <input value={username} onChange={e=>setUsername(e.target.value)} required
                  className="w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="your_username"/>
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 font-medium mb-1 block">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="you@example.com"/>
            </div>
            <div>
              <label className="text-xs text-white/50 font-medium mb-1 block">Password</label>
              <div className="relative">
                <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}
                  className="w-full px-4 py-3 pr-11 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="••••••••"/>
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-bold text-base rounded-xl shadow-lg shadow-violet-900/30 mt-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-xs text-white/25">or</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          <button onClick={continueAsGuest} disabled={loading}
            className="w-full mt-3 py-3 text-sm font-medium text-white/50 hover:text-white/80 bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-xl transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : null}
            Continue as Guest
          </button>
        </div>

        <p className="text-center text-xs text-white/20 mt-4">
          {SUPABASE_ENABLED ? "Synced across devices" : "All data stored locally on this device"}
        </p>
      </div>
    </div>
  );
}
