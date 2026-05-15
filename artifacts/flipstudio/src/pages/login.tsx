import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Film, Loader2, Eye, EyeOff, Sparkles, User, Mail, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Watermark } from "@/components/watermark";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  shape: "circle" | "square" | "film";
}

function useParticles(count: number) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const colors = ["#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#4c1d95", "#c4b5fd"];
    const initial: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.04,
      vy: (Math.random() - 0.5) * 0.04,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      shape: ["circle", "circle", "circle", "square", "film"][Math.floor(Math.random() * 5)] as Particle["shape"],
    }));
    setParticles(initial);

    let last = performance.now();
    const animate = (now: number) => {
      const dt = now - last;
      last = now;
      setParticles((prev) =>
        prev.map((p) => {
          let nx = p.x + p.vx * dt * 0.1;
          let ny = p.y + p.vy * dt * 0.1;
          let nvx = p.vx;
          let nvy = p.vy;
          if (nx < 0 || nx > 100) { nvx = -nvx; nx = Math.max(0, Math.min(100, nx)); }
          if (ny < 0 || ny > 100) { nvy = -nvy; ny = Math.max(0, Math.min(100, ny)); }
          return { ...p, x: nx, y: ny, vx: nvx, vy: nvy };
        })
      );
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [count]);

  return particles;
}

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login, signup } = useAuth();
  const particles = useParticles(40);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await signup(username, email, password);
      }
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#050508]">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(109,40,217,0.35) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(124,58,237,0.2) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(76,29,149,0.15) 0%, transparent 60%)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Floating particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: p.opacity,
              transform: `rotate(${p.x * 3}deg)`,
            }}
          >
            {p.shape === "film" ? (
              <Film
                style={{ width: p.size * 6, height: p.size * 6, color: p.color }}
              />
            ) : p.shape === "square" ? (
              <div
                style={{
                  width: p.size * 4,
                  height: p.size * 4,
                  backgroundColor: p.color,
                  borderRadius: 2,
                }}
              />
            ) : (
              <div
                style={{
                  width: p.size * 4,
                  height: p.size * 4,
                  borderRadius: "50%",
                  backgroundColor: p.color,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl bg-violet-600 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-8 blur-3xl bg-purple-800 pointer-events-none" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          animation: "slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(13,13,18,0.85)",
            border: "1px solid rgba(139,92,246,0.25)",
            boxShadow:
              "0 0 0 1px rgba(139,92,246,0.1), 0 24px 60px rgba(0,0,0,0.6), 0 0 80px rgba(109,40,217,0.08)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "rgba(109,40,217,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Film className="w-8 h-8 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">FlipStudio</h1>
            <p className="text-sm text-violet-300/60 mt-1">Professional 2D Animation Studio</p>
          </div>

          {/* Tabs */}
          <div className="flex mb-6 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: tab === t ? "rgba(109,40,217,0.6)" : "transparent",
                  color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: tab === t ? "0 2px 12px rgba(109,40,217,0.3)" : "none",
                }}
                onClick={() => { setTab(t); setError(""); }}
              >
                {t === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username (signup only) */}
            {tab === "signup" && (
              <div className="relative" style={{ animation: "slideDown 0.25s ease both" }}>
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/60 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/60 pointer-events-none" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/60 pointer-events-none" />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2 rounded-lg text-xs text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading
                  ? "rgba(109,40,217,0.4)"
                  : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
                boxShadow: loading ? "none" : "0 4px 20px rgba(109,40,217,0.4), 0 0 0 1px rgba(139,92,246,0.3)",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? "Please wait..." : tab === "login" ? "Enter Studio" : "Create Account"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
            {tab === "login" ? "New here? " : "Already have an account? "}
            <button
              className="text-violet-400/70 hover:text-violet-400 transition-colors underline underline-offset-2"
              onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(""); }}
            >
              {tab === "login" ? "Create an account" : "Log in instead"}
            </button>
          </p>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.18)" }}>
          Just sign up with any username & password to get started
        </p>
      </div>

      <Watermark />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
