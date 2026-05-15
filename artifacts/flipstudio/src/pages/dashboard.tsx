import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Plus, Film, Clock, Trash2, MoreVertical, Search,
  Grid3X3, List, Settings, LogOut, Sparkles, FolderOpen,
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
  if (diff < 3600000) return Math.floor(diff/60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff/3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff/86400000) + "d ago";
  return d.toLocaleDateString();
}

function ProjectCard({ project, onDelete, onOpen }: { project: Project; onDelete: (id: number) => void; onOpen: (id: number) => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative bg-white/3 hover:bg-white/5 border border-white/8 hover:border-violet-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-violet-950/30"
      onClick={() => onOpen(project.id)}>
      <div className="aspect-video bg-gradient-to-br from-violet-950/30 to-fuchsia-950/30 relative overflow-hidden">
        {project.thumbnail
          ? <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover"/>
          : <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 opacity-30">
                <Film className="w-8 h-8 text-violet-400"/>
                <span className="text-xs text-white/50">{project.width}×{project.height}</span>
              </div>
            </div>
        }
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
            <div className="bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">Open</div>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white truncate">{project.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5"/>{formatDate(project.updatedAt || project.createdAt)}
              </span>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/30">{project.fps} fps</span>
            </div>
          </div>
          <div className="relative">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
              onClick={e=>{e.stopPropagation();setMenu(m=>!m);}}>
              <MoreVertical className="w-3.5 h-3.5"/>
            </button>
            {menu && (
              <div className="absolute right-0 top-8 z-20 w-36 bg-[#131320] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <button className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                  onClick={e=>{e.stopPropagation();setMenu(false);onDelete(project.id);}}>
                  <Trash2 className="w-3.5 h-3.5"/> Delete
                </button>
              </div>
            )}
          </div>
        </div>
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

  useEffect(() => {
    void db.projects.list().then(p => { setProjects(p); setLoading(false); });
  }, []);

  const deleteProject = async (id: number) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await db.projects.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    toast({ title: "Project deleted" });
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#080811]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#c026d3"/>
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#dg)"/>
              <rect x="8" y="28" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="8" y="42" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="8" y="56" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="83" y="28" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="83" y="42" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="83" y="56" width="9" height="9" rx="2" fill="rgba(0,0,0,0.35)"/>
              <rect x="22" y="18" width="56" height="64" rx="4" fill="rgba(0,0,0,0.25)"/>
              <rect x="27" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.85)"/>
              <rect x="53" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.12)"/>
              <rect x="27" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.12)"/>
              <rect x="53" y="48" width="20" height="20" rx="3" fill="rgba(255,255,255,0.12)"/>
              <line x1="31" y1="35" x2="42" y2="27" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round"/>
              <polygon points="42,27 44,31 40,32" fill="#7c3aed"/>
            </svg>
            <div>
              <p className="text-sm font-bold leading-none tracking-tight">FlipStudio</p>
              <p className="text-[9px] text-white/30 leading-none mt-0.5">Animation Studio</p>
            </div>
          </div>

          <div className="flex-1"/>

          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 w-48 transition-all focus:w-64"
              placeholder="Search projects…"/>
          </div>

          {/* View mode */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5">
            <button className={cn("w-7 h-7 rounded flex items-center justify-center transition-colors",viewMode==="grid"?"bg-white/15 text-white":"text-white/30")} onClick={()=>setViewMode("grid")}><Grid3X3 className="w-3.5 h-3.5"/></button>
            <button className={cn("w-7 h-7 rounded flex items-center justify-center transition-colors",viewMode==="list"?"bg-white/15 text-white":"text-white/30")} onClick={()=>setViewMode("list")}><List className="w-3.5 h-3.5"/></button>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg text-white/30 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors" onClick={()=>setLocation("/settings")}>
              <Settings className="w-4 h-4"/>
            </button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-violet-500/30 bg-violet-700 flex items-center justify-center shrink-0 cursor-pointer" onClick={()=>setLocation("/settings")}>
              {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover"/> : <span className="text-xs font-bold">{user?.username?.[0]?.toUpperCase()??"U"}</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Hero row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
            <p className="text-sm text-white/40 mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
          </div>
          <Button
            onClick={()=>setLocation("/projects/new")}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 shadow-lg shadow-violet-900/40 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2"/> New Project
          </Button>
        </div>

        {loading ? (
          <div className={cn("grid gap-4", viewMode==="grid" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1")}>
            {[1,2,3,4].map(i=>(
              <div key={i} className="bg-white/3 rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-white/5"/>
                <div className="p-3"><div className="h-3 bg-white/5 rounded w-2/3"/></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8 text-violet-400"/>
            </div>
            <h2 className="text-xl font-bold mb-2">{search ? "No results" : "Start animating!"}</h2>
            <p className="text-white/40 text-sm max-w-xs mb-6">
              {search ? "No projects match your search." : "Create your first frame-by-frame animation project."}
            </p>
            {!search && (
              <Button onClick={()=>setLocation("/projects/new")}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0">
                <Plus className="w-4 h-4 mr-2"/> Create Project
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p=>(
              <ProjectCard key={p.id} project={p}
                onDelete={id=>void deleteProject(id)}
                onOpen={id=>setLocation("/projects/"+id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p=>(
              <div key={p.id} className="flex items-center gap-4 bg-white/3 hover:bg-white/5 border border-white/8 hover:border-violet-500/20 rounded-xl px-4 py-3 cursor-pointer transition-all group"
                onClick={()=>setLocation("/projects/"+p.id)}>
                <div className="w-12 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-violet-950/50 to-fuchsia-950/50 shrink-0">
                  {p.thumbnail ? <img src={p.thumbnail} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-violet-400/40"/></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-white/30">{formatDate(p.updatedAt||p.createdAt)} · {p.width}×{p.height} · {p.fps}fps</p>
                </div>
                <button className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  onClick={e=>{e.stopPropagation();void deleteProject(p.id);}}>
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <Watermark />
    </div>
  );
}
