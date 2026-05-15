import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Plus, Film, Clock, Trash2, Search, LogOut, Sparkles,
  Copy, Edit3, Check, X, ChevronDown, Settings, Grid2x2, LayoutList,
} from "lucide-react";
import { Watermark } from "@/components/watermark";
import { useAuth } from "@/lib/auth";
import { db, type Project } from "@/lib/local-db";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
  return d.toLocaleDateString();
}

function DeleteConfirm({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#16162a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-400"/>
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-1">Delete {count} project{count !== 1 ? "s" : ""}?</h3>
        <p className="text-sm text-white/40 text-center mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-white/8 text-white/60 font-semibold hover:bg-white/12 transition-colors active:scale-98">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-400 transition-colors active:scale-98 shadow-lg shadow-red-900/30">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#16162a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-bold text-white mb-4">Rename Project</h3>
        <input autoFocus value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onClose(); }}
          className="w-full px-4 py-3 bg-white/[0.06] border border-white/15 rounded-2xl text-white outline-none focus:border-violet-500/60 mb-4"/>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/8 text-white/60 font-semibold">Cancel</button>
          <button onClick={() => onSave(val)} className="flex-1 py-3 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project, selected, selectionMode,
  onOpen, onSelect, onLongPress, onDelete, onDuplicate, onRename,
}: {
  project: Project;
  selected: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const handleTouchStart = () => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onLongPress();
      navigator.vibrate?.(30);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (longPressed.current) return;
    if (selectionMode) { onSelect(); return; }
    onOpen();
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-150 active:scale-[0.97]",
        selectionMode && selected
          ? "border-violet-500 ring-2 ring-violet-500/40 bg-violet-600/10"
          : "border-white/[0.07] bg-white/[0.03] hover:border-violet-500/30 hover:bg-white/[0.05]"
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={() => { if (selectionMode) { onSelect(); return; } if (!menuOpen) onOpen(); }}>

      {/* Selection checkbox */}
      {selectionMode && (
        <div className={cn(
          "absolute top-2 left-2 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
          selected ? "bg-violet-600 border-violet-500" : "bg-black/60 border-white/30"
        )}>
          {selected && <Check className="w-3 h-3 text-white"/>}
        </div>
      )}

      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-violet-950/40 to-fuchsia-950/20 relative overflow-hidden">
        {project.thumbnail
          ? <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover"/>
          : <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-8 h-8 text-violet-400/25"/>
            </div>
        }
        {/* Top badges */}
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur text-[9px] text-white/70 px-1.5 py-0.5 rounded-full font-medium">
          {project.fps}fps
        </div>
      </div>

      {/* Info row */}
      <div className="p-2.5 flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] text-white truncate leading-tight">{project.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-white/25 shrink-0"/>
            <span className="text-[10px] text-white/30">{formatDate(project.updatedAt || project.createdAt)}</span>
            <span className="text-[10px] text-white/15">·</span>
            <span className="text-[10px] text-white/25">{project.width}×{project.height}</span>
          </div>
        </div>

        {/* 3-dot menu (non-selection mode) */}
        {!selectionMode && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(m => !m)}>
              <ChevronDown className="w-3.5 h-3.5"/>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                <div className="absolute right-0 bottom-full mb-1 z-20 w-40 bg-[#1c1c30] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onRename(); }}>
                    <Edit3 className="w-3.5 h-3.5"/> Rename
                  </button>
                  <button className="w-full text-left px-3.5 py-2.5 text-xs text-white/60 hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                    onClick={() => { setMenuOpen(false); onDuplicate(); }}>
                    <Copy className="w-3.5 h-3.5"/> Duplicate
                  </button>
                  <div className="h-px bg-white/[0.07] mx-3"/>
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "name">("updated");

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Rename modal
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);

  // User menu
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    void db.projects.list().then(p => { setProjects(p); setLoading(false); });
  }, []);

  const reload = useCallback(async () => {
    const all = await db.projects.list();
    setProjects(all);
  }, []);

  const enterSelectionMode = useCallback((id?: number) => {
    setSelectionMode(true);
    if (id !== undefined) setSelectedIds(new Set([id]));
    else setSelectedIds(new Set());
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

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sorted.map(p => p.id)));
  }, []);

  const deleteSelected = useCallback(async () => {
    for (const id of selectedIds) await db.projects.delete(id);
    await reload();
    toast({ title: `Deleted ${selectedIds.size} project${selectedIds.size !== 1 ? "s" : ""}` });
    exitSelectionMode();
    setShowDeleteConfirm(false);
  }, [selectedIds, reload, exitSelectionMode, toast]);

  const deleteSingle = useCallback(async (id: number) => {
    await db.projects.delete(id);
    await reload();
    toast({ title: "Project deleted" });
  }, [reload, toast]);

  const duplicateProject = useCallback(async (id: number) => {
    await db.projects.duplicate(id);
    await reload();
    toast({ title: "Project duplicated" });
  }, [reload, toast]);

  const renameProject = useCallback(async (id: number, name: string) => {
    if (!name.trim()) return;
    await db.projects.update(id, { name });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setRenamingProject(null);
  }, []);

  const sorted = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a18]/90 backdrop-blur-xl sticky top-0 z-20 shrink-0">
        {selectionMode ? (
          /* Selection mode header */
          <div className="h-14 flex items-center px-4 gap-3">
            <button onClick={exitSelectionMode}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors">
              <X className="w-5 h-5"/>
            </button>
            <span className="font-semibold text-white">{selectedIds.size} selected</span>
            <div className="flex-1"/>
            <button onClick={selectAll} className="text-xs text-violet-400 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors">
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
          /* Normal header */
          <div className="h-14 flex items-center px-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                <Film className="w-4 h-4 text-white"/>
              </div>
              <span className="font-bold text-sm bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                FlipStudio
              </span>
            </div>

            <div className="flex-1"/>

            {/* Search */}
            <div className="relative flex-1 max-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-2 h-9 bg-white/[0.05] border border-white/10 text-sm text-white placeholder-white/25 rounded-xl outline-none focus:border-violet-500/40 focus:bg-white/[0.07]"/>
            </div>

            {/* View mode */}
            <div className="flex bg-white/[0.04] rounded-xl p-0.5">
              <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white")}
                onClick={() => setViewMode("grid")}><Grid2x2 className="w-3.5 h-3.5"/></button>
              <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white")}
                onClick={() => setViewMode("list")}><LayoutList className="w-3.5 h-3.5"/></button>
            </div>

            {/* User avatar */}
            <div className="relative">
              <button
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-violet-900/30"
                onClick={() => setShowUserMenu(m => !m)}>
                {user?.username?.charAt(0).toUpperCase() ?? "?"}
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}/>
                  <div className="absolute right-0 top-11 z-20 w-48 bg-[#1c1c30] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.07]">
                      <p className="text-sm font-semibold text-white">{user?.username}</p>
                      <p className="text-[11px] text-white/40">{user?.email}</p>
                    </div>
                    <button className="w-full text-left px-4 py-2.5 text-xs text-white/60 hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                      onClick={() => { setShowUserMenu(false); setLocation("/settings"); }}>
                      <Settings className="w-3.5 h-3.5"/> Settings
                    </button>
                    <div className="h-px bg-white/[0.07] mx-3"/>
                    <button className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors"
                      onClick={() => { setShowUserMenu(false); logout(); }}>
                      <LogOut className="w-3.5 h-3.5"/> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-28">
        {/* Stats + sort */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-white/40">{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
          <div className="flex-1"/>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="h-8 bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 rounded-xl px-2.5 outline-none">
            <option value="updated">Recent</option>
            <option value="created">Created</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Hold-to-select hint */}
        {!selectionMode && projects.length > 0 && (
          <p className="text-[11px] text-white/20 mb-3 text-center">Hold a project card to select and delete</p>
        )}

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-500/15 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-violet-400/60"/>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">{search ? "No results" : "Start creating"}</h2>
              <p className="text-sm text-white/35">{search ? `No projects matching "${search}"` : "Tap the + button to create your first animation"}</p>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden animate-pulse">
                <div className="aspect-video bg-white/[0.04]"/>
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-white/[0.05] rounded w-3/4"/>
                  <div className="h-2 bg-white/[0.03] rounded w-1/2"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid view */}
        {!loading && sorted.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sorted.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                selected={selectedIds.has(p.id)}
                selectionMode={selectionMode}
                onOpen={() => setLocation(`/projects/${p.id}`)}
                onSelect={() => toggleSelect(p.id)}
                onLongPress={() => enterSelectionMode(p.id)}
                onDelete={() => { setSelectedIds(new Set([p.id])); setShowDeleteConfirm(true); }}
                onDuplicate={() => void duplicateProject(p.id)}
                onRename={() => setRenamingProject(p)}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && sorted.length > 0 && viewMode === "list" && (
          <div className="space-y-1.5">
            {sorted.map(p => (
              <div key={p.id}
                className={cn(
                  "relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-150 active:scale-[0.99]",
                  selectionMode && selectedIds.has(p.id)
                    ? "border-violet-500 bg-violet-600/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                )}
                onClick={() => selectionMode ? toggleSelect(p.id) : setLocation(`/projects/${p.id}`)}
                onTouchStart={() => {
                  const t = setTimeout(() => {
                    enterSelectionMode(p.id);
                    navigator.vibrate?.(30);
                  }, 500);
                  const clear = () => clearTimeout(t);
                  document.addEventListener("touchend", clear, { once: true });
                  document.addEventListener("touchmove", clear, { once: true });
                }}>
                {selectionMode && (
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    selectedIds.has(p.id) ? "bg-violet-600 border-violet-500" : "border-white/30")}>
                    {selectedIds.has(p.id) && <Check className="w-3 h-3 text-white"/>}
                  </div>
                )}
                <div className="w-14 h-9 rounded-xl overflow-hidden bg-white/[0.04] shrink-0 border border-white/[0.06]">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover"/> : <Film className="w-full h-full p-2.5 text-white/15"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{p.width}×{p.height} · {p.fps}fps · {formatDate(p.updatedAt || p.createdAt)}</p>
                </div>
                {!selectionMode && (
                  <div className="flex gap-1">
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/8 transition-colors"
                      onClick={e => { e.stopPropagation(); void duplicateProject(p.id); }}>
                      <Copy className="w-3.5 h-3.5"/>
                    </button>
                    <button className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={e => { e.stopPropagation(); setSelectedIds(new Set([p.id])); setShowDeleteConfirm(true); }}>
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom FAB — New Project */}
      {!selectionMode && (
        <div className="fixed bottom-6 right-5 z-30">
          <button
            onClick={() => setLocation("/projects/new")}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-2xl shadow-violet-900/50 flex items-center justify-center hover:from-violet-500 hover:to-fuchsia-500 active:scale-95 transition-all">
            <Plus className="w-7 h-7 text-white"/>
          </button>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <DeleteConfirm
          count={selectedIds.size}
          onConfirm={() => void deleteSelected()}
          onCancel={() => { setShowDeleteConfirm(false); if (!selectionMode) setSelectedIds(new Set()); }}
        />
      )}

      {/* Rename modal */}
      {renamingProject && (
        <RenameModal
          project={renamingProject}
          onSave={name => void renameProject(renamingProject.id, name)}
          onClose={() => setRenamingProject(null)}
        />
      )}

      <Watermark/>
    </div>
  );
}
