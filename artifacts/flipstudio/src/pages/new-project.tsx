import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Film, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/local-db";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "HD Landscape", w: 1920, h: 1080, fps: 24, icon: "🖥" },
  { label: "Square", w: 1080, h: 1080, fps: 24, icon: "⬜" },
  { label: "Portrait 9:16", w: 1080, h: 1920, fps: 24, icon: "📱" },
  { label: "4K", w: 3840, h: 2160, fps: 24, icon: "🎬" },
  { label: "Classic Anime", w: 1280, h: 720, fps: 12, icon: "🎌" },
  { label: "GIF Small", w: 480, h: 270, fps: 15, icon: "🎞" },
  { label: "Storyboard", w: 1600, h: 900, fps: 12, icon: "📋" },
  { label: "Twitter/X", w: 1280, h: 720, fps: 30, icon: "𝕏" },
];

const BG_COLORS = [
  { label: "Dark", color: "#111115" },
  { label: "Black", color: "#000000" },
  { label: "White", color: "#ffffff" },
  { label: "Off-white", color: "#f5f5f0" },
  { label: "Sky", color: "#e0f2fe" },
  { label: "Cream", color: "#fffbeb" },
  { label: "Gray", color: "#6b7280" },
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("My Animation");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(24);
  const [bgColor, setBgColor] = useState("#111115");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [creating, setCreating] = useState(false);

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
      });
      // Create initial frame
      const frameId = await db.frames.create({
        projectId, order: 0, duration: 0, canvasData: "", thumbnail: "", createdAt: now,
      });
      // Create initial layer
      await db.layers.create({
        frameId, projectId, name: "Layer 1", order: 0, visible: true, locked: false,
        opacity: 100, blendMode: "source-over", canvasData: JSON.stringify({ strokes: [] }), createdAt: now,
      });
      toast({ title: "Project created!" });
      setLocation(`/projects/${projectId}`);
    } catch (e) {
      toast({ title: "Failed to create project", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col">
      <div className="h-12 border-b border-white/[0.07] bg-[#0b0b18] flex items-center px-3 gap-2">
        <button className="w-8 h-8 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5"
          onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-white"/>
        </div>
        <span className="font-bold text-sm text-white/90">New Project</span>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Name */}
        <div>
          <Label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Project Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)}
            className="bg-white/[0.05] border-white/10 text-white text-base rounded-xl h-12 focus:border-violet-500/50 focus:ring-0"
            placeholder="My Animation"/>
        </div>

        {/* Presets */}
        <div>
          <Label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Canvas Preset</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p, i) => (
              <button key={i}
                className={cn("p-3 rounded-xl border text-left transition-all",
                  selectedPreset === i ? "border-violet-500/50 bg-violet-600/10" : "border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03]")}
                onClick={() => applyPreset(i)}>
                <div className="text-lg mb-1">{p.icon}</div>
                <div className="text-xs font-semibold text-white/70">{p.label}</div>
                <div className="text-[10px] text-white/30">{p.w}×{p.h}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom dimensions */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-white/35 mb-1 block">Width (px)</Label>
            <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value))}
              className="bg-white/[0.05] border-white/10 text-white rounded-xl h-10 focus:border-violet-500/50 focus:ring-0"/>
          </div>
          <div>
            <Label className="text-xs text-white/35 mb-1 block">Height (px)</Label>
            <Input type="number" value={height} onChange={e => setHeight(Number(e.target.value))}
              className="bg-white/[0.05] border-white/10 text-white rounded-xl h-10 focus:border-violet-500/50 focus:ring-0"/>
          </div>
          <div>
            <Label className="text-xs text-white/35 mb-1 block">FPS</Label>
            <select value={fps} onChange={e => setFps(Number(e.target.value))}
              className="w-full h-10 bg-white/[0.05] border border-white/10 text-white rounded-xl px-2 text-sm outline-none">
              {[1,2,4,6,8,10,12,15,18,24,25,30,60].map(f => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>
        </div>

        {/* Background */}
        <div>
          <Label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Background Color</Label>
          <div className="flex gap-2 flex-wrap">
            {BG_COLORS.map(({ label, color }) => (
              <button key={color}
                className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all",
                  bgColor === color ? "border-violet-500/50 bg-violet-600/10" : "border-white/[0.07] hover:border-white/15")}
                onClick={() => setBgColor(color)}>
                <div className="w-8 h-8 rounded-lg border border-white/10 shadow-inner"
                  style={{ backgroundColor: color }}/>
                <span className="text-[10px] text-white/35">{label}</span>
              </button>
            ))}
            <div className="flex flex-col items-center gap-1 px-3 py-2">
              <label className="w-8 h-8 rounded-lg border border-dashed border-white/20 cursor-pointer hover:border-violet-400 transition-colors flex items-center justify-center relative overflow-hidden">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"/>
                <div className="w-full h-full rounded-lg" style={{ backgroundColor: bgColor }}/>
              </label>
              <span className="text-[10px] text-white/35">Custom</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-20 h-12 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: bgColor }}>
              <Film className="w-5 h-5 text-white/20"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">{name || "Untitled"}</p>
              <p className="text-xs text-white/35">{width}×{height} · {fps}fps · {Math.round(width/height*100)/100}:1 ratio</p>
            </div>
          </div>
        </div>

        <Button onClick={handleCreate} disabled={creating}
          className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 rounded-xl font-bold text-base shadow-lg shadow-violet-900/30 gap-2">
          {creating ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"/></> : <><Sparkles className="w-4 h-4"/> Create Project</>}
        </Button>
      </div>
    </div>
  );
}
