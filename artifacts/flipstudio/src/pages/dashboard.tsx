import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Plus, Film, Clock, Trash2, MoreVertical, Search,
  Grid3X3, List, Settings, LogOut, Sparkles, FolderOpen,
  Copy, Edit3, Download, Star, Palette, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Watermark } from "@/components/watermark";
import { useAuth } from "@/lib/auth";
import { db, type Project } from "@/lib/local-db";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
  return d.toLocaleDateString();
}

function ProjectCard({
  project, onDelete, onOpen, onDuplicate, onRename,
}: {
  project: Project;
  onDelete: (id: number) => void;
  onOpen: (id: number) => void;
  onDuplicate: (id: number) => void;
  onRename: (id: number, name: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);

  return (
    <div
      className="group relative bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] hover:border-violet-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-violet-950/30"
      onClick={() => !renaming && onOpen(project.id)}>
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-violet-950/30 to-fuchsia-950/20 relative overflow-hidden">
        {project.thumbnail
          ? <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover"/>
          : <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 opacity-25">
                <Film className="w-8 h-8 text-violet-400"/>
                <span className="text-xs text-white/50">{project.width}×{project.height}</span>
              </div>
            </div>
        }
        <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
            <div className="bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
              Open Studio
            </div>
          </div>
        </div>
        {/* Frame count badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-[9px] text-white/60 px-1.5 py-0.5 rounded-full">
          {project.fps}fps
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {renaming ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onRename(project.id, nameVal); setRenaming(false); }}
            onKeyDown={e => {
              if (e.key === "Enter") { onRename(project.id, nameVal); setRenaming(false); }
              if (e.key === "Escape") { setNameVal(project.name); setRenaming(false); }
            }}
            className="w-full bg-white/8 border border-violet-500/30 rounded-lg text-sm text-white px-2 py-1 outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{project.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-white/25 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5"/>{formatDate(project.updatedAt || project.createdAt)}
                </span>
                <span className="text-[10px] text-white/15">·</span>
                <span className="text-[10px] text-white/25">{project.width}×{project.height}</span>
              </div>
            </div>
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                onClick={e => { e.stopPropagation(); setMenu(m => !m); }}>
                <MoreVertical className="w-3.5 h-3.5"/>
              </button>
              {menu && (
                <div className="absolute right-0 top-8 z-30 w-40 bg-[#131320] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <button className="w-full text-left px-3 py-2 text-xs text-white/60 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    onClick={() => { setMenu(false); setRenaming(true); }}>
                    <Edit3 className="w-3.5 h-3.5"/> Rename
                  </button>
                  <button className="w-full text-left px-3 py-2 text-xs text-white/60 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    onClick={() => { setMenu(false); onDuplicate(project.id); }}>
                    <Copy className="w-3.5 h-3.5"/> Duplicate
                  </button>
                  <div className="h-px bg-white/[0.07] mx-2"/>
                  <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    onClick={() => { setMenu(false); onDelete(project.id); }}>
                    <Trash2 className="w-3.5 h-3.5"/> Delete
                  </button>
                </div>
              )}
            </div>
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

  useEffect(() => {
    void db.projects.list().then(p => { setProjects(p); setLoading(false); });
  }, []);

  const deleteProject = useCallback(async (id: number) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await db.projects.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    toast({ title: "Project deleted" });
  }, [toast]);

  const duplicateProject = useCallback(async (id: number) => {
    toast({ title: "Duplicating…" });
    await db.projects.duplicate(id);
    const all = await db.projects.list();
    setProjects(all);
    toast({ title: "Project duplicated!" });
  }, [toast]);

  const renameProject = useCallback(async (id: number, name: string) => {
    if (!name.trim()) return;
    await db.projects.update(id, { name });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
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
      <header className="border-b border-white/[0.06] bg-[#0a0a18]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Film className="w-4 h-4 text-white"/>
            </div>
            <span className="font-bold text-base bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              FlipStudio
            </span>
          </div>

          <div className="flex-1"/>

          {/* Search */}
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25"/>
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-8 h-8 bg-white/[0.05] border-white/10 text-sm text-white placeholder-white/25 rounded-xl focus:border-violet-500/40 focus:ring-0 focus:bg-white/[0.07]"/>
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="h-8 bg-white/[0.05] border border-white/10 text-xs text-white/50 rounded-lg px-2 outline-none">
            <option value="updated">Recent</option>
            <option value="created">Created</option>
            <option value="name">Name</option>
          </select>

          {/* View mode */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5">
            <button className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all",
              viewMode === "grid" ? "bg-white/10 text-white" : "text-white/30 hover:text-white")}
              onClick={() => setViewMode("grid")}><Grid3X3 className="w-3.5 h-3.5"/></button>
            <button className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all",
              viewMode === "list" ? "bg-white/10 text-white" : "text-white/30 hover:text-white")}
              onClick={() => setViewMode("list")}><List className="w-3.5 h-3.5"/></button>
          </div>

          {/* User menu */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.07]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <span className="text-sm text-white/50 hidden sm:block">{user?.username}</span>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors"
              onClick={() => setLocation("/settings")}>
              <Settings className="w-3.5 h-3.5"/>
            </button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={logout}>
              <LogOut className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{projects.length}</span>
            <span className="text-sm text-white/35">project{projects.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex-1"/>
          <Button
            className="h-9 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 rounded-xl shadow-lg shadow-violet-900/30 gap-2 text-sm font-semibold"
            onClick={() => setLocation("/projects/new")}>
            <Plus className="w-4 h-4"/> New Project
          </Button>
        </div>

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
              <Film className="w-9 h-9 text-violet-400"/>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">
                {search ? "No matching projects" : "Start your animation"}
              </h2>
              <p className="text-sm text-white/35">
                {search ? `No projects matching "${search}"` : "Create your first project to begin animating"}
              </p>
            </div>
            {!search && (
              <Button
                className="bg-violet-600 hover:bg-violet-500 gap-2"
                onClick={() => setLocation("/projects/new")}>
                <Plus className="w-4 h-4"/> Create Project
              </Button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden animate-pulse">
                <div className="aspect-video bg-white/[0.03]"/>
                <div className="p-3 space-y-1.5">
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
                onOpen={id => setLocation(`/projects/${id}`)}
                onDelete={deleteProject}
                onDuplicate={duplicateProject}
                onRename={renameProject}
              />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && sorted.length > 0 && viewMode === "list" && (
          <div className="space-y-1">
            {sorted.map(p => (
              <div key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] hover:border-violet-500/25 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all group"
                onClick={() => setLocation(`/projects/${p.id}`)}>
                <div className="w-14 h-9 rounded-lg overflow-hidden bg-white/[0.04] shrink-0">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover"/> : <Film className="w-full h-full p-2 text-white/15"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-white/25">{p.width}×{p.height} · {p.fps}fps · {formatDate(p.updatedAt || p.createdAt)}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"
                    onClick={e => { e.stopPropagation(); void duplicateProject(p.id); }}>
                    <Copy className="w-3.5 h-3.5"/>
                  </button>
                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/40 hover:text-red-400 hover:bg-red-500/10"
                    onClick={e => { e.stopPropagation(); void deleteProject(p.id); }}>
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Watermark/>
    </div>
  );
}
