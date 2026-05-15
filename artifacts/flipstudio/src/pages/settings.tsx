import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, User, Bell, Shield, Palette, LogOut, Save, Check, Trash2, Info,
  Brush, Layers, Download, Keyboard, Moon, Vibrate, HelpCircle, ExternalLink,
  ChevronRight, Star, Zap, Film, RefreshCw, AlertTriangle, Globe, Mail, MessageCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/local-db";
import { cn } from "@/lib/utils";
import { Watermark } from "@/components/watermark";

interface Prefs {
  autosave: boolean;
  autosaveInterval: number;
  onionSkinning: boolean;
  showGrid: boolean;
  hapticFeedback: boolean;
  highQualityExport: boolean;
  brushSmoothing: boolean;
  pressureSensitivity: boolean;
  showTips: boolean;
  darkCanvas: boolean;
  compactUI: boolean;
  exportFormat: "gif" | "png" | "mp4";
  defaultBrushSize: number;
  defaultOpacity: number;
  defaultFps: number;
  gridSize: number;
  thumbnailQuality: "low" | "medium" | "high";
  antialiasing: boolean;
}

const DEFAULT_PREFS: Prefs = {
  autosave: true,
  autosaveInterval: 1200,
  onionSkinning: true,
  showGrid: false,
  hapticFeedback: true,
  highQualityExport: false,
  brushSmoothing: true,
  pressureSensitivity: true,
  showTips: true,
  darkCanvas: false,
  compactUI: false,
  exportFormat: "gif",
  defaultBrushSize: 8,
  defaultOpacity: 100,
  defaultFps: 12,
  gridSize: 32,
  thumbnailQuality: "medium",
  antialiasing: true,
};

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem("flipstudio_prefs") ?? "{}") as Partial<Prefs>) }; }
  catch { return DEFAULT_PREFS; }
}

function ToggleRow({ label, desc, value, onChange, icon }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {icon && <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0 text-violet-400">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 leading-tight">{label}</p>
        {desc && <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "w-12 h-6 rounded-full transition-all duration-200 relative shrink-0 press",
          value ? "bg-violet-600" : "bg-white/10"
        )}>
        <div className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200",
          value ? "translate-x-6" : "translate-x-0.5"
        )}/>
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        {desc && <p className="text-[10px] text-white/35">{desc}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user, logout, updateProfile, deleteAccount } = useAuth();
  const { toast } = useToast();

  const [prefs, setPrefs]           = useState<Prefs>(loadPrefs);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username ?? "");
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useState(() => {
    void db.projects.list().then(ps => setProjectCount(ps.length));
  });

  const setPref = <K extends keyof Prefs>(key: K, val: Prefs[K]) => {
    setPrefs(p => ({ ...p, [key]: val }));
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("flipstudio_prefs", JSON.stringify(prefs));
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const handleClearData = async () => {
    setClearingData(true);
    try {
      const projects = await db.projects.list();
      for (const p of projects) await db.projects.delete(p.id);
      localStorage.removeItem("flipstudio_prefs");
      toast({ title: "All data cleared", description: "All projects deleted." });
      setLocation("/");
    } finally {
      setClearingData(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSaveProfile = () => {
    if (!newUsername.trim()) return;
    updateProfile({ username: newUsername.trim() });
    setEditingName(false);
    toast({ title: "Profile updated" });
  };

  return (
    <div className="min-h-screen page-enter-left bg-[#06060f] text-white flex flex-col">
      {/* Aurora */}
      <div className="aurora-bg pointer-events-none opacity-40">
        <div className="aurora-blob aurora-blob-1"/>
        <div className="aurora-blob aurora-blob-2"/>
      </div>

      {/* Header */}
      <header className="glass-header h-14 flex items-center px-4 gap-3 shrink-0 relative z-10">
        <button onClick={() => setLocation("/")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors press">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="font-black text-base text-white">Settings</h1>
          <p className="text-[10px] text-white/25">Preferences &amp; profile</p>
        </div>
        <div className="flex-1"/>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm shadow-lg shadow-violet-900/40 transition-all disabled:opacity-60 press">
          {saved ? <><Check className="w-3.5 h-3.5"/> Saved</> : saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <><Save className="w-3.5 h-3.5"/> Save</>}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-10 relative z-1">

        {/* Profile */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<User className="w-4 h-4"/>} title="Profile" desc="Your account"/>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-violet-900/40 shrink-0">
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    autoFocus value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveProfile(); if (e.key === "Escape") setEditingName(false); }}
                    className="glass-input flex-1 px-3 py-2 text-sm rounded-xl"/>
                  <button onClick={handleSaveProfile}
                    className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center press">
                    <Check className="w-4 h-4 text-white"/>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-bold text-white">{user?.username ?? "—"}</p>
                    <p className="text-xs text-white/35 truncate">{user?.email}</p>
                  </div>
                  <button onClick={() => setEditingName(true)}
                    className="text-xs text-violet-400/60 hover:text-violet-300 ml-auto transition-colors">
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-lg font-black text-white">{projectCount ?? "…"}</p>
              <p className="text-[10px] text-white/35">Projects</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-lg font-black text-white">Active</span>
              </div>
              <p className="text-[10px] text-white/35">Account Status</p>
            </div>
          </div>
        </div>

        {/* Studio Preferences */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Brush className="w-4 h-4"/>} title="Drawing" desc="Studio behavior"/>
          <div className="space-y-0 divide-y divide-white/[0.04]">
            <ToggleRow icon={<Save className="w-3.5 h-3.5"/>} label="Auto-save" desc="Automatically save while drawing" value={prefs.autosave} onChange={v => setPref("autosave", v)}/>
            <ToggleRow icon={<Layers className="w-3.5 h-3.5"/>} label="Onion Skinning" desc="Show ghost of previous frames" value={prefs.onionSkinning} onChange={v => setPref("onionSkinning", v)}/>
            <ToggleRow icon={<Brush className="w-3.5 h-3.5"/>} label="Brush Smoothing" desc="Smooth out stroke jitter" value={prefs.brushSmoothing} onChange={v => setPref("brushSmoothing", v)}/>
            <ToggleRow icon={<Zap className="w-3.5 h-3.5"/>} label="Pressure Sensitivity" desc="Vary opacity with touch pressure" value={prefs.pressureSensitivity} onChange={v => setPref("pressureSensitivity", v)}/>
          </div>
        </div>

        {/* UI Preferences */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Palette className="w-4 h-4"/>} title="Interface" desc="Display &amp; layout"/>
          <div className="space-y-0 divide-y divide-white/[0.04]">
            <ToggleRow icon={<Globe className="w-3.5 h-3.5"/>} label="Show Grid by Default" desc="Enable drawing grid on open" value={prefs.showGrid} onChange={v => setPref("showGrid", v)}/>
            <ToggleRow icon={<Moon className="w-3.5 h-3.5"/>} label="Dark Canvas" desc="Dark background in studio" value={prefs.darkCanvas} onChange={v => setPref("darkCanvas", v)}/>
            <ToggleRow icon={<Vibrate className="w-3.5 h-3.5"/>} label="Haptic Feedback" desc="Vibration on mobile actions" value={prefs.hapticFeedback} onChange={v => setPref("hapticFeedback", v)}/>
            <ToggleRow icon={<HelpCircle className="w-3.5 h-3.5"/>} label="Show Tips" desc="Helpful hints during editing" value={prefs.showTips} onChange={v => setPref("showTips", v)}/>
          </div>
        </div>

        {/* Default Values */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Zap className="w-4 h-4"/>} title="Defaults" desc="Starting values for new projects"/>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Default Brush Size: {prefs.defaultBrushSize}px</label>
              <input type="range" min={1} max={80} value={prefs.defaultBrushSize}
                onChange={e => setPref("defaultBrushSize", parseInt(e.target.value))}
                className="w-full accent-violet-500"/>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Default Opacity: {prefs.defaultOpacity}%</label>
              <input type="range" min={10} max={100} step={5} value={prefs.defaultOpacity}
                onChange={e => setPref("defaultOpacity", parseInt(e.target.value))}
                className="w-full accent-violet-500"/>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Auto-save Delay: {(prefs.autosaveInterval / 1000).toFixed(1)}s</label>
              <div className="flex gap-2">
                {[600, 1200, 2000, 3000, 5000].map(ms => (
                  <button key={ms} onClick={() => setPref("autosaveInterval", ms)}
                    className={cn("flex-1 h-9 rounded-xl text-xs font-bold transition-all press",
                      prefs.autosaveInterval === ms
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                        : "glass-btn")}>
                    {(ms / 1000).toFixed(1)}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Default FPS: {prefs.defaultFps}</label>
              <div className="flex gap-2">
                {[8, 12, 15, 24, 30].map(f => (
                  <button key={f} onClick={() => setPref("defaultFps", f)}
                    className={cn("flex-1 h-9 rounded-xl text-xs font-bold transition-all press",
                      prefs.defaultFps === f
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                        : "glass-btn")}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Grid Size: {prefs.gridSize}px</label>
              <div className="flex gap-2">
                {[16, 24, 32, 48, 64].map(s => (
                  <button key={s} onClick={() => setPref("gridSize", s)}
                    className={cn("flex-1 h-9 rounded-xl text-xs font-bold transition-all press",
                      prefs.gridSize === s
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                        : "glass-btn")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-1.5 block">Thumbnail Quality</label>
              <div className="flex gap-2">
                {(["low","medium","high"] as const).map(q => (
                  <button key={q} onClick={() => setPref("thumbnailQuality", q)}
                    className={cn("flex-1 h-9 rounded-xl text-xs font-bold capitalize transition-all press",
                      prefs.thumbnailQuality === q
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                        : "glass-btn")}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Download className="w-4 h-4"/>} title="Export" desc="Default output settings"/>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 block">Default Format</label>
              <div className="flex gap-2">
                {(["gif", "png", "mp4"] as const).map(f => (
                  <button key={f} onClick={() => setPref("exportFormat", f)}
                    className={cn("flex-1 h-9 rounded-xl text-xs font-bold uppercase transition-all press",
                      prefs.exportFormat === f
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40"
                        : "glass-btn")}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow label="High-quality Export" desc="Export at full resolution (larger files)" value={prefs.highQualityExport} onChange={v => setPref("highQualityExport", v)}/>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Keyboard className="w-4 h-4"/>} title="Keyboard Shortcuts" desc="Studio hotkeys — works with hardware keyboard"/>
          {[
            { group: "Tools", items: [["P","Pencil"],["B","Brush"],["E","Eraser"],["G","Calligraphy"],["F","Fill"],["I","Eyedropper"],["T","Text / Type"],["S","Select"],["V","Pan / Move"],["Q","Polygon"],["L","Line"],["R","Rectangle"],["O","Ellipse"]] },
            { group: "Actions", items: [["Ctrl+Z","Undo"],["Ctrl+Y","Redo"],["Ctrl+C","Copy layer"],["Ctrl+V","Paste layer"],["Del","Clear layer"],["Space","Play / Pause"]] },
            { group: "Canvas", items: [["[","Brush size −"],["]","Brush size +"],["Ctrl+ +","Zoom in"],["Ctrl+ −","Zoom out"],["Ctrl+0","Reset zoom"],["Escape","Cancel / Exit"]] },
            { group: "Frames", items: [["←","Prev frame"],["→","Next frame"],["Ctrl+D","Duplicate frame"],["Ctrl+Del","Delete frame"]] },
          ].map(section => (
            <div key={section.group} className="mb-3">
              <p className="text-[9px] text-white/25 uppercase tracking-wider font-bold mb-2">{section.group}</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                {section.items.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded-md bg-white/8 border border-white/12 text-[9px] font-mono text-white/60 font-bold whitespace-nowrap shrink-0">{key}</kbd>
                    <span className="text-[10px] text-white/40 truncate">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Support */}
          <div className="glass-panel rounded-2xl p-4">
            <SectionHeader icon={<MessageCircle className="w-4 h-4"/>} title="Support" desc="Get help from the developer"/>
            <p className="text-xs text-white/40 leading-relaxed mb-3">
              Having an issue or want to suggest a feature? Send a message directly to the developer.
            </p>
            <a href="mailto:piyushpk811@gmail.com"
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-violet-600/10 hover:border-violet-500/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                <Mail className="w-5 h-5"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">Email the Developer</p>
                <p className="text-xs text-white/40 font-medium">piyushpk811@gmail.com</p>
              </div>
              <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-colors shrink-0"/>
            </a>
            <div className="flex items-center gap-2 mt-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
              <p className="text-xs text-white/40">Usually replies within <span className="text-emerald-400 font-semibold">24 hours</span></p>
            </div>
          </div>

          {/* About */}
        <div className="glass-panel rounded-2xl p-4">
          <SectionHeader icon={<Info className="w-4 h-4"/>} title="About FlipStudio" desc="v2.0.0"/>
          <div className="space-y-2">
            <p className="text-xs text-white/40 leading-relaxed">
              Offline-first professional animation studio. All your data is stored securely on this device using IndexedDB. No internet required.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: "Version",   value: "2.0.0" },
                { label: "Engine",    value: "Canvas 2D" },
                { label: "Storage",   value: "IndexedDB" },
                { label: "Platform",  value: "Capacitor" },
              ].map(r => (
                <div key={r.label} className="glass-card rounded-xl p-2.5">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">{r.label}</p>
                  <p className="text-xs font-semibold text-white/70 mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold transition-all press shadow-lg shadow-violet-900/40 flex items-center justify-center gap-2 disabled:opacity-60">
            {saved ? <><Check className="w-4 h-4"/> Saved!</> : saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <><Save className="w-4 h-4"/> Save Settings</>}
          </button>
          <button onClick={logout}
            className="flex-1 h-12 rounded-2xl glass-btn flex items-center justify-center gap-2 font-semibold text-sm press">
            <LogOut className="w-4 h-4"/> Sign Out
          </button>
        </div>

        {/* Danger zone */}
        <div className="glass-panel rounded-2xl p-4 border border-red-500/15">
          <SectionHeader icon={<AlertTriangle className="w-4 h-4 text-red-400"/>} title="Danger Zone" desc="Irreversible actions"/>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/80">Clear All Projects</p>
                <p className="text-[11px] text-white/35">Permanently delete all animations</p>
              </div>
              {showDeleteConfirm ? (
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs rounded-xl glass-btn">Cancel</button>
                  <button onClick={() => void handleClearData()} disabled={clearingData}
                    className="px-3 py-1.5 text-xs rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold press disabled:opacity-60">
                    {clearingData ? "Deleting…" : "Confirm"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 font-semibold transition-colors press">
                  Clear Data
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/15 py-2">
          FlipStudio v2.0 · Made by Piyush 💜
        </p>
      </main>
    </div>
  );
}
