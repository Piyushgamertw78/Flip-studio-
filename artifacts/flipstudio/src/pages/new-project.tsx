import { useState } from "react";
import { Watermark } from "@/components/watermark";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Sparkles, Film, Monitor, Smartphone, Square, ChevronDown, Zap } from "lucide-react";
import { db } from "@/lib/local-db";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Preset {
  label: string;
  width: number;
  height: number;
  fps: number;
  icon: string;
  category: string;
  badge?: string;
}

const PRESETS: Preset[] = [
  // Social
  { label: "Instagram Post",     width: 1080, height: 1080, fps: 12, icon: "📸", category: "social", badge: "Popular" },
  { label: "Instagram Story",    width: 1080, height: 1920, fps: 24, icon: "📱", category: "social" },
  { label: "Instagram Reel",     width: 1080, height: 1920, fps: 30, icon: "🎵", category: "social", badge: "Trending" },
  { label: "TikTok",             width: 1080, height: 1920, fps: 30, icon: "🎬", category: "social" },
  { label: "YouTube Shorts",     width: 1080, height: 1920, fps: 30, icon: "▶️", category: "social" },
  { label: "Twitter GIF",        width: 800,  height: 450,  fps: 15, icon: "🐦", category: "social" },
  { label: "Facebook Post",      width: 1200, height: 630,  fps: 12, icon: "👤", category: "social" },
  // Video
  { label: "Full HD 1080p",      width: 1920, height: 1080, fps: 24, icon: "🖥️", category: "video", badge: "HD" },
  { label: "4K Ultra HD",        width: 3840, height: 2160, fps: 24, icon: "📺", category: "video", badge: "4K" },
  { label: "720p HD",            width: 1280, height: 720,  fps: 24, icon: "🎥", category: "video" },
  { label: "Cinematic 2.35:1",   width: 2350, height: 1000, fps: 24, icon: "🎞️", category: "video" },
  { label: "4:3 Classic",        width: 1024, height: 768,  fps: 24, icon: "📼", category: "video" },
  // Animation
  { label: "Square 512",         width: 512,  height: 512,  fps: 12, icon: "⬛", category: "animation", badge: "Sticker" },
  { label: "Square 1080",        width: 1080, height: 1080, fps: 24, icon: "🔲", category: "animation" },
  { label: "GIF Small",          width: 480,  height: 480,  fps: 15, icon: "🔄", category: "animation" },
  { label: "Web Banner",         width: 728,  height: 90,   fps: 12, icon: "📣", category: "animation" },
  { label: "Leaderboard",        width: 970,  height: 250,  fps: 12, icon: "🏆", category: "animation" },
  // Game
  { label: "Sprite Sheet",       width: 256,  height: 256,  fps: 12, icon: "🎮", category: "game" },
  { label: "Game Intro",         width: 1920, height: 1080, fps: 60, icon: "🕹️", category: "game", badge: "60fps" },
  { label: "Mobile Game 9:16",   width: 1080, height: 1920, fps: 30, icon: "📲", category: "game" },
  // Print
  { label: "Postcard",           width: 1748, height: 1240, fps: 12, icon: "📮", category: "print" },
  { label: "A4 Landscape",       width: 2480, height: 1754, fps: 12, icon: "📄", category: "print" },
];

const CATEGORIES = [
  { id: "all",       label: "All" },
  { id: "social",    label: "Social" },
  { id: "video",     label: "Video" },
  { id: "animation", label: "Animate" },
  { id: "game",      label: "Game" },
  { id: "print",     label: "Print" },
];

const FPS_OPTIONS = [8, 12, 15, 24, 25, 30, 48, 60];

const BG_PRESETS = [
  { label: "White",        value: "#ffffff" },
  { label: "Black",        value: "#000000" },
  { label: "Dark",         value: "#111111" },
  { label: "Transparent",  value: "transparent" },
  { label: "Sky",          value: "#87CEEB" },
  { label: "Sunset",       value: "#FF6B6B" },
  { label: "Night",        value: "#0a0a2e" },
  { label: "Forest",       value: "#1a4d2e" },
];

export default function NewProjectPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName]           = useState("My Animation");
  const [category, setCategory]   = useState("all");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [width, setWidth]         = useState(1080);
  const [height, setHeight]       = useState(1080);
  const [fps, setFps]             = useState(12);
  const [bgColor, setBgColor]     = useState("#ffffff");
  const [customBg, setCustomBg]   = useState("#ffffff");
  const [loading, setLoading]     = useState(false);
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [tags, setTags]           = useState("");

  const filtered = PRESETS.filter(p => category === "all" || p.category === category);

  const selectPreset = (p: Preset) => {
    setSelectedPreset(p);
    setWidth(p.width);
    setHeight(p.height);
    setFps(p.fps);
    if (!name || name === "My Animation") setName(p.label);
  };

  const create = async () => {
    if (!name.trim()) { toast({ title: "Give your project a name", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const tagList = tags.trim() ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const projectId = await db.projects.create({
        name: name.trim(), description: "", width, height, fps,
        backgroundColor: bgColor, thumbnail: "", createdAt: now, updatedAt: now, tags: tagList,
      });
      const frameId = await db.frames.create({
        projectId, order: 0, duration: 0,
        canvasData: JSON.stringify({ strokes: [] }), thumbnail: "", createdAt: now,
      });
      await db.layers.create({
        frameId, projectId, name: "Layer 1", order: 0, visible: true, locked: false,
        opacity: 100, blendMode: "source-over",
        canvasData: JSON.stringify({ strokes: [] }), createdAt: now,
      });
      toast({ title: "Project created!", description: "Opening studio…" });
      setLocation(`/projects/${projectId}`);
    } catch (err) {
      toast({ title: "Failed to create project", description: String(err), variant: "destructive" });
      setLoading(false);
    }
  };

  const aspectRatio = width / height;
  const previewW = Math.min(90, 90 * aspectRatio);
  const previewH = Math.min(50, 50 / aspectRatio);

  return (
    <div className="min-h-screen bg-[#06060f] text-white flex flex-col overflow-x-hidden">
      {/* Aurora */}
      <div className="aurora-bg pointer-events-none">
        <div className="aurora-blob aurora-blob-1 opacity-30"/>
        <div className="aurora-blob aurora-blob-3 opacity-20"/>
      </div>

      {/* Header */}
      <header className="glass-header h-14 flex items-center px-4 gap-3 shrink-0 relative z-10">
        <button onClick={() => setLocation("/")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors press">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-black text-base text-white leading-none">New Animation</h1>
          <p className="text-[10px] text-white/25 mt-0.5">Choose a canvas &amp; settings</p>
        </div>
        <div className="flex-1"/>
        <button
          onClick={() => void create()}
          disabled={loading}
          className="flex items-center gap-2 px-4 h-9 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600
            hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm
            shadow-lg shadow-violet-900/40 active:scale-95 transition-all disabled:opacity-60 press">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <><Sparkles className="w-3.5 h-3.5"/> Create</>}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-1">

        {/* Name */}
        <div className="glass-panel rounded-2xl p-4">
          <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 block">Project Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Animation"
            className="glass-input w-full px-4 py-3 text-base font-semibold rounded-xl"
            autoFocus
          />
        </div>

        {/* Canvas size */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-white">Canvas Size</p>
              <p className="text-xs text-white/35">{width} × {height} px</p>
            </div>
            <div className="w-[100px] h-[56px] flex items-center justify-center">
              <div
                className="border-2 border-violet-500/40 rounded-lg bg-gradient-to-br from-violet-600/10 to-fuchsia-600/10 flex items-center justify-center"
                style={{ width: previewW + 10, height: previewH + 10 }}>
                <span className="text-[7px] text-violet-400/60 font-mono leading-tight text-center">{width}×{height}</span>
              </div>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
            {CATEGORIES.map(c => (
              <button key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 press",
                  category === c.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                    : "glass-btn"
                )}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
            {filtered.map((p, i) => {
              const isSelected = selectedPreset?.label === p.label;
              return (
                <button key={i}
                  onClick={() => selectPreset(p)}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all press",
                    isSelected
                      ? "border-violet-500 bg-violet-600/12"
                      : "border-white/6 bg-white/[0.03] hover:border-violet-500/30 hover:bg-white/[0.05]"
                  )}>
                  <span className="text-lg">{p.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className={cn("text-xs font-semibold truncate", isSelected ? "text-white" : "text-white/70")}>{p.label}</p>
                      {p.badge && (
                        <span className="text-[7px] bg-violet-600/30 text-violet-300 px-1 py-0.5 rounded-full font-bold shrink-0">{p.badge}</span>
                      )}
                    </div>
                    <p className="text-[9px] text-white/30">{p.width}×{p.height} · {p.fps}fps</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom size toggle */}
          <button
            onClick={() => setShowCustomSize(s => !s)}
            className="flex items-center gap-2 text-xs text-violet-400/60 hover:text-violet-300 mt-3 transition-colors">
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCustomSize && "rotate-180")}/>
            Custom dimensions
          </button>

          {showCustomSize && (
            <div className="mt-3 grid grid-cols-2 gap-2 fade-in-up">
              {[
                { label: "Width (px)",  val: width,  set: setWidth,  min: 32, max: 7680 },
                { label: "Height (px)", val: height, set: setHeight, min: 32, max: 7680 },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] text-white/35 block mb-1">{f.label}</label>
                  <input
                    type="number" value={f.val} min={f.min} max={f.max}
                    onChange={e => f.set(Math.max(f.min, Math.min(f.max, parseInt(e.target.value) || f.min)))}
                    className="glass-input w-full px-3 py-2.5 text-sm rounded-xl"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FPS */}
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-white">Frame Rate</p>
              <p className="text-xs text-white/35">{fps} fps</p>
            </div>
            <span className="text-3xl font-black gradient-text-violet">{fps}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {FPS_OPTIONS.map(f => (
              <button key={f}
                onClick={() => setFps(f)}
                className={cn(
                  "h-10 rounded-xl text-sm font-bold transition-all press",
                  fps === f
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40"
                    : "glass-btn"
                )}>
                {f}
              </button>
            ))}
          </div>
          <input type="range" min={1} max={60} value={fps}
            onChange={e => setFps(parseInt(e.target.value))}
            className="w-full accent-violet-500 h-1.5 rounded-full"/>
          <p className="text-[10px] text-white/25 mt-2">
            {fps <= 12 ? "🎨 Classic hand-drawn feel" :
             fps <= 24 ? "🎬 Cinema quality" :
             fps <= 30 ? "📱 Social media smooth" :
             "⚡ Ultra smooth"}
          </p>
        </div>

        {/* Background */}
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">Background</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {BG_PRESETS.map(b => (
              <button key={b.value}
                onClick={() => setBgColor(b.value)}
                className={cn(
                  "h-10 rounded-xl border-2 flex items-center justify-center text-[9px] font-semibold transition-all press overflow-hidden",
                  bgColor === b.value ? "border-violet-500 scale-105 shadow-lg shadow-violet-900/30" : "border-white/10 hover:border-white/25"
                )}
                title={b.label}
                style={{
                  background: b.value === "transparent"
                    ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 10px 10px"
                    : b.value,
                }}>
                {bgColor === b.value && (
                  <div className="w-3 h-3 rounded-full bg-white/80 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-600"/>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={customBg}
              onChange={e => { setCustomBg(e.target.value); setBgColor(e.target.value); }}
              className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"/>
            <div>
              <p className="text-xs font-semibold text-white/60">Custom Color</p>
              <p className="text-[10px] text-white/25 font-mono">{customBg.toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Tags (optional) */}
        <div className="glass-panel rounded-2xl p-4">
          <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 block">
            Tags <span className="text-white/20 normal-case font-normal">(comma-separated, optional)</span>
          </label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g. personal, loop, work"
            className="glass-input w-full px-4 py-2.5 text-sm rounded-xl"
          />
        </div>

        {/* Summary */}
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-3">Summary</p>
          <div className="space-y-2.5">
            {[
              { label: "Name",       value: name || "—" },
              { label: "Canvas",     value: `${width} × ${height} px` },
              { label: "Frame Rate", value: `${fps} fps` },
              { label: "Background", value: bgColor === "transparent" ? "Transparent" : bgColor.toUpperCase() },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-xs text-white/35">{r.label}</span>
                <span className="text-xs font-semibold text-white/70 font-mono">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={() => void create()}
          disabled={loading}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600
            hover:from-violet-500 hover:to-fuchsia-500 text-white font-black text-base
            shadow-2xl shadow-violet-900/50 active:scale-[0.98] transition-all
            flex items-center justify-center gap-2.5 disabled:opacity-60 press mb-8">
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin"/> Creating…</>
            : <><Sparkles className="w-5 h-5"/> Create Animation</>}
        </button>
      </div>
      <Watermark />
    </div>
  );
}
