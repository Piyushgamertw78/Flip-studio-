import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Sparkles, Monitor, Smartphone, Square, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/local-db";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Square", w: 1080, h: 1080, fps: 24, icon: Square, desc: "Best for mobile" },
  { label: "Portrait 9:16", w: 1080, h: 1920, fps: 24, icon: Smartphone, desc: "Mobile/Reels" },
  { label: "HD 16:9", w: 1920, h: 1080, fps: 24, icon: Monitor, desc: "Widescreen" },
  { label: "Anime 12fps", w: 1280, h: 720, fps: 12, icon: Clapperboard, desc: "Classic" },
  { label: "GIF Small", w: 480, h: 480, fps: 15, icon: Square, desc: "Fast export" },
  { label: "4K", w: 3840, h: 2160, fps: 24, icon: Monitor, desc: "Ultra HD" },
];

const BG_COLORS = [
  { label: "White", color: "#ffffff" },
  { label: "Black", color: "#000000" },
  { label: "Dark", color: "#111115" },
  { label: "Off-white", color: "#f5f5f0" },
  { label: "Sky", color: "#e0f2fe" },
  { label: "Transparent", color: "transparent" },
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("My Animation");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(24);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [creating, setCreating] = useState(false);

  void user;

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx]!;
    setWidth(p.w); setHeight(p.h); setFps(p.fps);
    setSelectedPreset(idx);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast({ title: "Enter a project name", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const now = new Date().toISOString();
      const projectId = await db.projects.create({
        name: name.trim(), description: "", width, height, fps,
        backgroundColor: bgColor, thumbnail: "", createdAt: now, updatedAt: now,
        tags: [],
      });
      const frameId = await db.frames.create({
        projectId, order: 0, duration: 0, canvasData: "", thumbnail: "", createdAt: now,
      });
      await db.layers.create({
        frameId, projectId, name: "Layer 1", order: 0, visible: true, locked: false,
        opacity: 100, blendMode: "source-over", canvasData: JSON.stringify({ strokes: [] }), createdAt: now,
      });
      setLocation(`/projects/${projectId}`);
    } catch {
      toast({ title: "Failed to create project", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col pb-safe">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.07] bg-[#0b0b18] flex items-center px-4 gap-3 sticky top-0 z-10">
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
          onClick={() => setLocation("/")}>
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <span className="font-bold text-base text-white">New Project</span>
      </div>

      <div className="flex-1 px-4 py-5 space-y-6 max-w-lg mx-auto w-full">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Project Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3.5 bg-white/[0.06] border border-white/10 rounded-2xl text-white text-base outline-none focus:border-violet-500/60 transition-colors placeholder-white/20"
            placeholder="My Animation"
          />
        </div>

        {/* Canvas Preset */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block">Canvas Size</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i}
                  className={cn("p-3 rounded-2xl border text-left transition-all active:scale-95",
                    selectedPreset === i
                      ? "border-violet-500 bg-violet-600/15 shadow-lg shadow-violet-900/30"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/20")}
                  onClick={() => applyPreset(i)}>
                  <Icon className={cn("w-4 h-4 mb-2", selectedPreset === i ? "text-violet-400" : "text-white/40")}/>
                  <div className="text-xs font-semibold text-white/80 leading-tight">{p.label}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{p.w}×{p.h}</div>
                  <div className="text-[10px] text-violet-400/60 mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom dimensions */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Width", value: width, set: setWidth },
            { label: "Height", value: height, set: setHeight },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="text-[11px] text-white/35 mb-1.5 block">{label} (px)</label>
              <input type="number" value={value} onChange={e => set(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500/50 transition-colors"/>
            </div>
          ))}
          <div>
            <label className="text-[11px] text-white/35 mb-1.5 block">FPS</label>
            <select value={fps} onChange={e => setFps(Number(e.target.value))}
              className="w-full py-2.5 px-3 bg-white/[0.05] border border-white/10 text-white rounded-xl text-sm outline-none appearance-none">
              {[1,2,4,6,8,10,12,15,18,24,25,30,60].map(f => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>
        </div>

        {/* Background */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block">Background</label>
          <div className="flex gap-2 flex-wrap">
            {BG_COLORS.map(({ label, color }) => (
              <button key={color}
                className={cn("flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl border transition-all active:scale-95",
                  bgColor === color ? "border-violet-500 bg-violet-600/10" : "border-white/[0.07] hover:border-white/20")}
                onClick={() => setBgColor(color)}>
                <div className={cn("w-8 h-8 rounded-xl border border-white/15 shadow-inner",
                  color === "transparent" && "bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"4\" height=\"4\" fill=\"%23999\"/><rect x=\"4\" y=\"4\" width=\"4\" height=\"4\" fill=\"%23999\"/></svg>')] bg-repeat")}
                  style={{ backgroundColor: color !== "transparent" ? color : undefined }}/>
                <span className="text-[10px] text-white/40">{label}</span>
              </button>
            ))}
            <div className="flex flex-col items-center gap-1.5 px-3 py-2.5">
              <label className="w-8 h-8 rounded-xl border border-dashed border-white/20 cursor-pointer hover:border-violet-400 transition-colors relative overflow-hidden">
                <input type="color" value={bgColor === "transparent" ? "#ffffff" : bgColor} onChange={e => setBgColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                <div className="w-full h-full rounded-xl" style={{ backgroundColor: bgColor === "transparent" ? "#666" : bgColor }}/>
              </label>
              <span className="text-[10px] text-white/40">Custom</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="w-20 h-14 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: bgColor === "transparent" ? undefined : bgColor,
              backgroundImage: bgColor === "transparent" ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%)" : undefined,
              backgroundSize: bgColor === "transparent" ? "8px 8px" : undefined }}>
          </div>
          <div>
            <p className="font-semibold text-white/90 text-sm">{name || "Untitled"}</p>
            <p className="text-[11px] text-white/35 mt-0.5">{width}×{height} · {fps} fps</p>
          </div>
        </div>

        <Button onClick={handleCreate} disabled={creating}
          className="w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 rounded-2xl font-bold text-base shadow-xl shadow-violet-900/40 gap-2 active:scale-98 transition-all">
          {creating
            ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"/>
            : <><Sparkles className="w-5 h-5"/> Create Project</>}
        </Button>
      </div>
    </div>
  );
}
