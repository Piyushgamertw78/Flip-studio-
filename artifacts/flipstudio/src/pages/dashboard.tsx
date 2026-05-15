import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Plus, Film, Clock, Trash2, Search, LogOut, Sparkles,
  Copy, Edit3, Check, X, ChevronDown, Settings, Grid2x2, LayoutList,
  Star, Tag, Download, Upload, BarChart2, Layers, Palette,
  Heart, Zap, TrendingUp, Folder, MoreVertical, ArrowUpRight,
  RefreshCw, Eye, FolderOpen, Users, Globe, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db, type Project } from "@/lib/local-db";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Watermark } from "@/components/watermark";

const TEMPLATE_PROJECTS = [
  { name: "Bouncing Ball",     fps: 24, width: 800,  height: 600,  bg: "#ffffff", icon: "⚽", desc: "Classic animation basics" },
  { name: "Walk Cycle",        fps: 12, width: 1080, height: 1080, bg: "#f0f0f0", icon: "🚶", desc: "Character locomotion" },
  { name: "Looping GIF",       fps: 15, width: 480,  height: 480,  bg: "#000000", icon: "🔄", desc: "Short loop for social" },
  { name: "Sticker Pack",      fps: 12, width: 512,  height: 512,  bg: "transparent", icon: "✨", desc: "Animated sticker" },
  { name: "Logo Reveal",       fps: 24, width: 1920, height: 1080, bg: "#111111", icon: "🎬", desc: "Brand animation" },
  { name: "Instagram Reel",    fps: 24, width: 1080, height: 1920, bg: "#ffffff", icon: "📱", desc: "Vertical video" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatDuration(frames: number, fps: number) {
  const secs = frames / fps;
  if (secs < 60) return secs.toFixed(1) + "s";
  return Math.floor(secs / 60) + "m " + Math.round(secs % 60) + "s";
}

function StatsBar({ projects, totalFrames, storageLabel }: { projects: Project[]; totalFrames: number; storageLabel: string }) {
  const thisWeek = projects.filter(p => Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000).length;
  const stats = [
    { label: "Projects",   value: projects.length, sub: storageLabel,        icon: <Folder className="w-3.5 h-3.5"/>,     color: "text-violet-400" },
    { label: "Frames",     value: totalFrames,      sub: "total",             icon: <Film className="w-3.5 h-3.5"/>,       color: "text-fuchsia-400" },
    { label: "This Week",  value: thisWeek,         sub: "new project" + (thisWeek !== 1 ? "s" : ""), icon: <TrendingUp className="w-3.5 h-3.5"/>, color: "text-cyan-400" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {stats.map(s => (
        <div key={s.label} className="glass-card rounded-2xl p-3 text-center">
          <div className={cn("flex items-center justify-center mb-1", s.color)}>{s.icon}</div>
          <div className="text-lg font-black text-white leading-none">{s.value}</div>
          <div className="text-[9px] text-white/35 mt-0.5 leading-tight">{s.label}</div>
          <div className="text-[8px] text-white/20 mt-0.5">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DeleteConfirm({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-sm shadow-2xl fade-in-scale">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-400"/>
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-1">Delete {count} project{count !== 1 ? "s" : ""}?</h3>
        <p className="text-sm text-white/40 text-center mb-6">This cannot be undone. All frames and layers will be permanently removed.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl glass-btn font-semibold text-sm press">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors shadow-lg shadow-red-900/30 press">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({ project, onSave, onClose }: { project: Project; onSave: (name: string) => void; onClose: () => void }) {
  const [val, setVal] = useState(project.name);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-sm shadow-2xl fade-in-scale">
        <h3 className="text-base font-bold text-white mb-1">Rename Project</h3>
        <p className="text-xs text-white/35 mb-4">Give your animation a new name</p>
        <input
          autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onClose(); }}
          className="glass-input w-full px-4 py-3 rounded-2xl text-sm mb-4"
          placeholder="Animation name"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl glass-btn font-semibold text-sm press">Cancel</button>
          <button onClick={() => onSave(val)}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm transition-all press">
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: typeof TEMPLATE_PROJECTS[0]) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass-panel rounded-3xl w-full max-w-lg shadow-2xl fade-in-up max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-white/8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-violet-400"/>
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Start from Template</h3>
            <p className="text-xs text-white/35">Choose a preset to get started quickly</p>
          </div>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white p-2 rounded-xl hover:bg-white/8 transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2.5">
            {TEMPLATE_PROJECTS.map((t, i) => (
              <button key={i} onClick={() => { onCreate(t); onClose(); }}
                className="glass-card rounded-2xl p-4 text-left press transition-all">
                <div className="text-2xl mb-2">{t.icon}</div>
                <p className="font-bold text-sm text-white mb-0.5">{t.name}</p>
                <p className="text-[10px] text-white/40 mb-2">{t.desc}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[9px] bg-violet-600/20 text-violet-300 px-1.5 py-0.5 rounded-full">{t.fps}fps</span>
                  <span className="text-[9px] bg-white/8 text-white/40 px-1.5 py-0.5 rounded-full">{t.width}×{t.height}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project, selected, selectionMode,
  onOpen, onSelect, onLongPress, onDelete, onDuplicate, onRename, onStar,
}: {
  project: Project; selected: boolean; selectionMode: boolean;
  onOpen: () => void; onSelect: () => void; onLongPress: () => void;
  onDelete: () => void; onDuplicate: () => void; onRename: () => void;
  onStar: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed    = useRef(false);
  const touchHandled   = useRef(false);
  const starred = (project.tags ?? []).includes("⭐");

  const startLong = () => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onLongPress();
      navigator.vibrate?.(30);
    }, 500);
  };
  const endLong = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (longPressed.current) return;
    if (selectionMode) { touchHandled.current = true; onSelect(); return; }
    touchHandled.current = true;
    onOpen();
  };
  const cancelLong = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-150 active:scale-[0.96]",
        selectionMode && selected
          ? "border-violet-500 ring-2 ring-violet-500/30 bg-violet-600/8"
          : "glass-card border-transparent hover:border-violet-500/25"
      )}
      onTouchStart={startLong} onTouchEnd={endLong} onTouchMove={cancelLong}
      onClick={() => { if (touchHandled.current) { touchHandled.current = false; return; } if (selectionMode) { onSelect(); return; } if (!menuOpen) onOpen(); }}>

      {selectionMode && (
        <div className={cn(
          "absolute top-2 left-2 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          selected ? "bg-violet-600 border-violet-500 shadow-lg shadow-violet-900/50" : "bg-black/60 border-white/30"
        )}>
          {selected && <Check className="w-3 h-3 text-white"/>}
        </div>
      )}

      {/* Star badge */}
      {starred && !selectionMode && (
        <div className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400"/>
        </div>
      )}

      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 relative overflow-hidden">
        {project.thumbnail
          ? <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover"/>
          : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-7 h-7 text-violet-400/20"/>
            </div>
          )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"/>
        <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur text-[8px] text-white/70 px-1.5 py-0.5 rounded-full font-semibold">
          {project.fps}fps
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] text-white truncate leading-tight">{project.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-white/20 shrink-0"/>
            <span className="text-[10px] text-white/25">{formatDate(project.updatedAt || project.createdAt)}</span>
            <span className="text-[10px] text-white/12">·</span>
            <span className="text-[10px] text-white/20">{project.width}×{project.height}</span>
          </div>
        </div>

        {!selectionMode && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(m => !m)}>
              <MoreVertical className="w-3.5 h-3.5"/>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                <div className="absolute right-0 bottom-full mb-1 z-20 w-44 glass-panel rounded-2xl shadow-2xl overflow-hidden">
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onOpen(); }}>
                    <Eye className="w-3.5 h-3.5 text-violet-400"/> Open
                  </button>
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onRename(); }}>
                    <Edit3 className="w-3.5 h-3.5 text-blue-400"/> Rename
                  </button>
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onDuplicate(); }}>
                    <Copy className="w-3.5 h-3.5 text-green-400"/> Duplicate
                  </button>
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onStar(); }}>
                    <Star className={cn("w-3.5 h-3.5", starred ? "text-amber-400 fill-amber-400" : "text-amber-400")}/> {starred ? "Unstar" : "Star"}
                  </button>
                  <div className="h-px bg-white/8 mx-3"/>
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onDelete(); }}>
                    <Trash2 className="w-3.5 h-3.5"/> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [viewMode, setViewMode]     = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy]         = useState<"updated" | "created" | "name">("updated");
  const [filterTag, setFilterTag]   = useState<"all" | "starred">("all");

  const [selectionMode, setSelectionMode]     = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showTemplates, setShowTemplates]     = useState(false);
  const [refreshing, setRefreshing]           = useState(false);
  const [totalFrames, setTotalFrames]         = useState(0);
  const [storageLabel, setStorageLabel]       = useState("0 KB");
  const importRef                             = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const all = await db.projects.list();
    setProjects(all);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Async total-frame count — runs after projects load
  useEffect(() => {
    if (projects.length === 0) { setTotalFrames(0); setStorageLabel("0 KB"); return; }
    let cancelled = false;
    const count = async () => {
      let frames = 0;
      let bytes = 0;
      for (const p of projects) {
        try {
          const fs = await db.frames.listByProject(p.id);
          frames += fs.length;
          for (const f of fs) bytes += (f.canvasData?.length ?? 0);
        } catch {}
      }
      if (cancelled) return;
      setTotalFrames(frames);
      const kb = bytes / 1024;
      setStorageLabel(kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.round(kb) + " KB");
    };
    void count();
    return () => { cancelled = true; };
  }, [projects]);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    toast({ title: "Refreshed" });
  }, [load, toast]);

  const enterSelectionMode = useCallback((id?: number) => {
    setSelectionMode(true);
    setSelectedIds(id !== undefined ? new Set([id]) : new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const sorted = projects
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchTag = filterTag === "all" || (filterTag === "starred" && (p.tags ?? []).includes("⭐"));
      return matchSearch && matchTag;
    })
    .sort((a, b) => {
      if (sortBy === "name")    return a.name.localeCompare(b.name);
      if (sortBy === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  const deleteSelected = useCallback(async () => {
    for (const id of selectedIds) await db.projects.delete(id);
    await load();
    toast({ title: `Deleted ${selectedIds.size} project${selectedIds.size !== 1 ? "s" : ""}` });
    exitSelectionMode();
    setShowDeleteConfirm(false);
  }, [selectedIds, load, exitSelectionMode, toast]);

  const deleteSingle = useCallback(async (id: number) => {
    await db.projects.delete(id);
    await load();
    toast({ title: "Project deleted" });
  }, [load, toast]);

  const duplicateProject = useCallback(async (id: number) => {
    await db.projects.duplicate(id);
    await load();
    toast({ title: "Project duplicated" });
  }, [load, toast]);

  const renameProject = useCallback(async (id: number, name: string) => {
    if (!name.trim()) return;
    await db.projects.update(id, { name });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setRenamingProject(null);
    toast({ title: "Renamed successfully" });
  }, []);

  const toggleStar = useCallback(async (p: Project) => {
    const tags = p.tags ?? [];
    const newTags = tags.includes("⭐") ? tags.filter(t => t !== "⭐") : [...tags, "⭐"];
    await db.projects.update(p.id, { tags: newTags });
    setProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, tags: newTags } : pr));
  }, []);

  // ── Export all projects as a JSON backup file ──────────────────────────────
  const exportBackup = useCallback(async () => {
    setShowUserMenu(false);
    try {
      const all = await db.projects.list();
      const data = [];
      for (const p of all) {
        const frames = await db.frames.listByProject(p.id);
        const framesWithLayers = [];
        for (const f of frames) {
          const layers = await db.layers.listByFrame(f.id);
          framesWithLayers.push({ ...f, layers });
        }
        data.push({ ...p, frames: framesWithLayers });
      }
      const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flipstudio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded!", description: `${all.length} project${all.length !== 1 ? "s" : ""} exported` });
    } catch (err) {
      toast({ title: "Export failed", description: String(err), variant: "destructive" });
    }
  }, [toast]);

  // ── Import projects from a JSON backup ─────────────────────────────────────
  const importBackup = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const projectsData = raw.projects ?? raw; // support both versioned and raw array
        if (!Array.isArray(projectsData)) throw new Error("Invalid backup format");
        let imported = 0;
        for (const p of projectsData) {
          const now = new Date().toISOString();
          const projectId = await db.projects.create({
            name: p.name + " (imported)", description: p.description ?? "",
            width: p.width, height: p.height, fps: p.fps,
            backgroundColor: p.backgroundColor ?? "#ffffff",
            thumbnail: "", createdAt: now, updatedAt: now, tags: p.tags ?? [],
          });
          for (const f of (p.frames ?? [])) {
            const frameId = await db.frames.create({
              projectId, order: f.order ?? 0, duration: f.duration ?? 0,
              canvasData: f.canvasData ?? JSON.stringify({ strokes: [] }),
              thumbnail: "", createdAt: now,
            });
            for (const l of (f.layers ?? [])) {
              await db.layers.create({
                frameId, projectId, name: l.name ?? "Layer 1",
                order: l.order ?? 0, visible: l.visible ?? true, locked: l.locked ?? false,
                opacity: l.opacity ?? 100, blendMode: l.blendMode ?? "source-over",
                canvasData: l.canvasData ?? JSON.stringify({ strokes: [] }), createdAt: now,
              });
            }
          }
          imported++;
        }
        await load();
        toast({ title: `Imported ${imported} project${imported !== 1 ? "s" : ""}!`, description: "Your backup has been restored." });
      } catch (err) {
        toast({ title: "Import failed", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset so same file can be re-imported
  }, [load, toast]);

  const createFromTemplate = useCallback(async (t: typeof TEMPLATE_PROJECTS[0]) => {
    const now = new Date().toISOString();
    const projectId = await db.projects.create({
      name: t.name, description: t.desc, width: t.width, height: t.height, fps: t.fps,
      backgroundColor: t.bg, thumbnail: "", createdAt: now, updatedAt: now, tags: [],
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
    await load();
    toast({ title: `Created "${t.name}"`, description: "Template loaded — happy animating!" });
    setLocation(`/projects/${projectId}`);
  }, [load, toast, setLocation]);

  return (
    <div className="min-h-screen bg-[#06060f] text-white flex flex-col">
      {/* Aurora */}
      <div className="aurora-bg pointer-events-none">
        <div className="aurora-blob aurora-blob-1 opacity-40"/>
        <div className="aurora-blob aurora-blob-2 opacity-30"/>
      </div>

      {/* Header */}
      <header className="glass-header sticky top-0 z-20 shrink-0">
        {selectionMode ? (
          <div className="h-14 flex items-center px-4 gap-3">
            <button onClick={exitSelectionMode}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors press">
              <X className="w-5 h-5"/>
            </button>
            <span className="font-bold text-white">{selectedIds.size} selected</span>
            <div className="flex-1"/>
            <button
              onClick={() => setSelectedIds(new Set(sorted.map(p => p.id)))}
              className="text-xs text-violet-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors">
              All
            </button>
            <button
              onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition-colors",
                selectedIds.size > 0
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-white/5 text-white/25 cursor-not-allowed")}>
              <Trash2 className="w-4 h-4"/> Delete
            </button>
          </div>
        ) : (
          <div className="h-14 flex items-center px-4 gap-2.5">
            {/* Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                <Film className="w-4 h-4 text-white"/>
              </div>
              <span className="font-black text-sm gradient-text-violet">FlipStudio</span>
            </div>

            <div className="flex-1"/>

            {/* Search */}
            <div className="relative flex-1 max-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none"/>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="glass-input w-full pl-8 pr-3 h-9 text-sm rounded-xl"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>

            {/* View mode */}
            <div className="flex bg-white/[0.05] rounded-xl p-0.5 shrink-0">
              <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                viewMode === "grid" ? "bg-white/12 text-white" : "text-white/25 hover:text-white")}
                onClick={() => setViewMode("grid")}><Grid2x2 className="w-3.5 h-3.5"/></button>
              <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                viewMode === "list" ? "bg-white/12 text-white" : "text-white/25 hover:text-white")}
                onClick={() => setViewMode("list")}><LayoutList className="w-3.5 h-3.5"/></button>
            </div>

            {/* Refresh */}
            <button onClick={refresh} disabled={refreshing}
              className="w-8 h-8 rounded-xl text-white/25 hover:text-white hover:bg-white/8 flex items-center justify-center transition-colors shrink-0">
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")}/>
            </button>

            {/* User */}
            <div className="relative shrink-0">
              <button
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-violet-900/40 press"
                onClick={() => setShowUserMenu(m => !m)}>
                {user?.username?.charAt(0).toUpperCase() ?? "?"}
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}/>
                  <div className="absolute right-0 top-11 z-20 w-52 glass-panel rounded-2xl shadow-2xl overflow-hidden fade-in-scale">
                    <div className="px-4 py-3 border-b border-white/8">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                          {user?.username?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                          <p className="text-[10px] text-white/35 truncate">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); setLocation("/settings"); }}>
                        <Settings className="w-3.5 h-3.5 text-violet-400"/> Settings & Profile
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); setShowTemplates(true); }}>
                        <Sparkles className="w-3.5 h-3.5 text-fuchsia-400"/> Templates
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); setFilterTag(f => f === "starred" ? "all" : "starred"); }}>
                        <Star className="w-3.5 h-3.5 text-amber-400"/> Starred Projects
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); setLocation("/whiteboard"); }}>
                        <Palette className="w-3.5 h-3.5 text-cyan-400"/> Whiteboard
                      </button>
                      <div className="h-px bg-white/8 mx-3 my-1"/>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => void exportBackup()}>
                        <Download className="w-3.5 h-3.5 text-green-400"/> Export Backup
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-white/55 hover:bg-white/6 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); importRef.current?.click(); }}>
                        <Upload className="w-3.5 h-3.5 text-blue-400"/> Import Backup
                      </button>
                      <div className="h-px bg-white/8 mx-3 my-1"/>
                      <button className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                        onClick={() => { setShowUserMenu(false); logout(); }}>
                        <LogOut className="w-3.5 h-3.5"/> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-28 relative z-1">
        {/* Stats */}
        {!loading && projects.length > 0 && <StatsBar projects={projects} totalFrames={totalFrames} storageLabel={storageLabel} />}

        {/* Filter + Sort bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
            {([["all", "All"], ["starred", "⭐ Starred"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilterTag(val)}
                className={cn("px-3 h-7 rounded-lg text-xs font-semibold transition-all",
                  filterTag === val ? "bg-white/12 text-white" : "text-white/30 hover:text-white")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1"/>
          <span className="text-xs text-white/25">{sorted.length} project{sorted.length !== 1 ? "s" : ""}</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="glass-input h-8 text-xs px-2.5 rounded-xl appearance-none cursor-pointer">
            <option value="updated">Recent</option>
            <option value="created">Oldest</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {!selectionMode && projects.length > 0 && (
          <p className="text-[10px] text-white/15 mb-3 text-center">Hold a card to enter selection mode</p>
        )}

        {/* Template quick-start — shown when no projects */}
        {!loading && projects.length === 0 && (
          <div className="space-y-6">
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center float">
                <Sparkles className="w-10 h-10 text-violet-400/70"/>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black text-white mb-1">Start Animating</h2>
                <p className="text-sm text-white/35">Create your first project or start from a template</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3 px-1">Quick Templates</p>
              <div className="grid grid-cols-2 gap-2.5 stagger">
                {TEMPLATE_PROJECTS.slice(0, 4).map((t, i) => (
                  <button key={i} onClick={() => void createFromTemplate(t)}
                    className="glass-card rounded-2xl p-4 text-left press">
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <p className="font-bold text-sm text-white mb-0.5">{t.name}</p>
                    <p className="text-[10px] text-white/40">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-white/5">
                <div className="aspect-video shimmer"/>
                <div className="p-2.5 space-y-2">
                  <div className="h-3 shimmer rounded-lg w-3/4"/>
                  <div className="h-2 shimmer rounded-lg w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No search results */}
        {!loading && projects.length > 0 && sorted.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <Search className="w-10 h-10 text-white/15"/>
            <p className="text-sm text-white/35">
              {filterTag === "starred" ? "No starred projects yet" : `No results for "${search}"`}
            </p>
            <button onClick={() => { setSearch(""); setFilterTag("all"); }}
              className="text-xs text-violet-400 hover:text-violet-300 underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Grid view */}
        {!loading && sorted.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 stagger">
            {sorted.map(p => (
              <ProjectCard key={p.id} project={p}
                selected={selectedIds.has(p.id)} selectionMode={selectionMode}
                onOpen={() => setLocation(`/projects/${p.id}`)}
                onSelect={() => toggleSelect(p.id)}
                onLongPress={() => enterSelectionMode(p.id)}
                onDelete={() => { setSelectedIds(new Set([p.id])); setShowDeleteConfirm(true); }}
                onDuplicate={() => void duplicateProject(p.id)}
                onRename={() => setRenamingProject(p)}
                onStar={() => void toggleStar(p)}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && sorted.length > 0 && viewMode === "list" && (
          <div className="space-y-2 stagger">
            {sorted.map(p => {
              const starred = (p.tags ?? []).includes("⭐");
              return (
                <div key={p.id}
                  className={cn(
                    "relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-150 cursor-pointer press",
                    selectionMode && selectedIds.has(p.id)
                      ? "border-violet-500 bg-violet-600/8"
                      : "glass-card border-transparent"
                  )}
                  onClick={() => selectionMode ? toggleSelect(p.id) : setLocation(`/projects/${p.id}`)}>
                  {selectionMode && (
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      selectedIds.has(p.id) ? "bg-violet-600 border-violet-500" : "border-white/30")}>
                      {selectedIds.has(p.id) && <Check className="w-3 h-3 text-white"/>}
                    </div>
                  )}
                  <div className="w-14 h-9 rounded-xl overflow-hidden bg-white/[0.04] shrink-0 border border-white/8">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover"/> : <Film className="w-full h-full p-2.5 text-white/15"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"/>}
                      <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                    </div>
                    <p className="text-[10px] text-white/25 mt-0.5">{p.width}×{p.height} · {p.fps}fps · {formatDate(p.updatedAt || p.createdAt)}</p>
                  </div>
                  {!selectionMode && (
                    <div className="flex gap-1">
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:bg-white/8 transition-colors press"
                        onClick={e => { e.stopPropagation(); void duplicateProject(p.id); }}>
                        <Copy className="w-3.5 h-3.5"/>
                      </button>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/30 hover:text-red-400 hover:bg-red-500/10 transition-colors press"
                        onClick={e => { e.stopPropagation(); setSelectedIds(new Set([p.id])); setShowDeleteConfirm(true); }}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:bg-white/8 transition-colors press"
                        onClick={e => { e.stopPropagation(); setLocation(`/projects/${p.id}`); }}>
                        <ChevronRight className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Hidden import input */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importBackup}/>

      {/* FAB */}
      {!selectionMode && (
        <div className="fixed bottom-6 right-5 z-30 flex flex-col-reverse items-end gap-3">
          <button
            onClick={() => setLocation("/projects/new")}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600
              shadow-2xl shadow-violet-900/60 flex items-center justify-center
              hover:from-violet-500 hover:to-fuchsia-500 active:scale-95 transition-all glow-violet press">
            <Plus className="w-7 h-7 text-white"/>
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-white/50 hover:text-violet-300 transition-colors press shadow-xl shadow-black/40"
            title="Templates">
            <Sparkles className="w-5 h-5"/>
          </button>
          <button
            onClick={() => setLocation("/whiteboard")}
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-white/50 hover:text-cyan-300 transition-colors press shadow-xl shadow-black/40"
            title="Whiteboard">
            <Palette className="w-5 h-5"/>
          </button>
        </div>
      )}

      {/* Modals */}
      {showDeleteConfirm && (
        <DeleteConfirm
          count={selectedIds.size}
          onConfirm={() => void deleteSelected()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {renamingProject && (
        <RenameModal
          project={renamingProject}
          onSave={name => void renameProject(renamingProject.id, name)}
          onClose={() => setRenamingProject(null)}
        />
      )}
      {showTemplates && (
        <TemplateModal
          onClose={() => setShowTemplates(false)}
          onCreate={t => void createFromTemplate(t)}
        />
      )}
      <Watermark />
    </div>
  );
}
