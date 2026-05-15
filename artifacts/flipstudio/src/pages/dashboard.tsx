import { useState, useEffect } from "react";
  import { useLocation } from "wouter";
  import { Plus, Film, Clock, Download, LayoutGrid, LogOut, Trash2, Copy, Settings, Search, Zap } from "lucide-react";
  import { format } from "date-fns";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import { Skeleton } from "@/components/ui/skeleton";
  import { Badge } from "@/components/ui/badge";
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Watermark } from "@/components/watermark";
  import { useAuth } from "@/lib/auth";
  import { db, type Project } from "@/lib/local-db";
  import { cn } from "@/lib/utils";

  export default function Dashboard() {
    const [, setLocation] = useLocation();
    const { user, logout } = useAuth();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [deleteTargetName, setDeleteTargetName] = useState("");
    const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

    const loadProjects = async () => {
      const all = await db.projects.list();
      setProjects(all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      setLoading(false);
    };

    useEffect(() => { void loadProjects(); }, []);

    const handleDeleteConfirm = async () => {
      if (deleteTargetId === null) return;
      await db.projects.delete(deleteTargetId);
      setDeleteTargetId(null);
      await loadProjects();
    };

    const handleDuplicate = async (projectId: number) => {
      setDuplicatingId(projectId);
      try {
        await db.projects.duplicate(projectId);
        await loadProjects();
      } finally {
        setDuplicatingId(null);
      }
    };

    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    );

    const totalFrames = projects.reduce((acc) => acc, 0);

    const STAT_CARDS = [
      { label: "Total Projects", value: projects.length, icon: <LayoutGrid className="w-5 h-5 text-violet-400" />, sub: "In your workspace" },
      { label: "Recent Edits", value: projects.filter(p => {
          const d = new Date(p.updatedAt);
          const now = new Date();
          return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
        }).length, icon: <Clock className="w-5 h-5 text-fuchsia-400" />, sub: "Last 7 days" },
      { label: "Exports", value: 0, icon: <Download className="w-5 h-5 text-cyan-400" />, sub: "All time" },
    ];

    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050508]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
            <div className="flex items-center gap-2 font-bold text-lg select-none">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">FlipStudio</span>
            </div>

            <div className="flex-1" />

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 w-52 transition-all"
              />
            </div>

            <Button
              size="sm"
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 gap-1.5 font-semibold"
              onClick={() => setLocation("/projects/new")}
            >
              <Plus className="w-4 h-4" /> New Project
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/20 hover:border-violet-500 transition-colors">
                  {user?.avatar
                    ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-violet-600 flex items-center justify-center text-sm font-bold">
                        {user?.username?.[0]?.toUpperCase() ?? "U"}
                      </div>
                  }
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#111118] border-white/10 text-white w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{user?.username}</p>
                  <p className="text-xs text-white/50 truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="gap-2 hover:bg-white/5 cursor-pointer" onClick={() => setLocation("/settings")}>
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 hover:bg-white/5 cursor-pointer" onClick={() => setLocation("/whiteboard")}>
                  <Zap className="w-4 h-4" /> Quick Whiteboard
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="gap-2 text-red-400 hover:bg-red-500/10 cursor-pointer" onClick={logout}>
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-8 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {STAT_CARDS.map(s => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{s.value}</p>
                    <p className="text-xs text-white/50 mt-0.5">{s.sub}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">{s.icon}</div>
                </div>
                <p className="text-sm text-white/60 mt-2 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Your Projects</h2>
              {projects.length > 0 && (
                <Badge variant="secondary" className="bg-white/10 text-white/60 border-0">
                  {filtered.length} project{filtered.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-52 rounded-xl bg-white/5" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Film className="w-8 h-8 text-violet-400" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {search ? "No projects match your search" : "No projects yet"}
                  </p>
                  <p className="text-white/40 text-sm mt-1">
                    {search ? "Try a different search term" : "Create your first animation project to get started"}
                  </p>
                </div>
                {!search && (
                  <Button
                    onClick={() => setLocation("/projects/new")}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(project => (
                  <div
                    key={project.id}
                    className="group relative rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:border-violet-500/50 transition-all cursor-pointer"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 relative">
                      {project.thumbnail ? (
                        <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Film className="w-10 h-10 text-white/10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors">
                              <span className="text-white text-lg leading-none">⋮</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#111118] border-white/10 text-white">
                            <DropdownMenuItem className="gap-2 hover:bg-white/5 cursor-pointer" onClick={() => setLocation(`/projects/${project.id}`)}>
                              <Film className="w-4 h-4" /> Open
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 hover:bg-white/5 cursor-pointer" onClick={() => handleDuplicate(project.id)} disabled={duplicatingId === project.id}>
                              <Copy className="w-4 h-4" /> {duplicatingId === project.id ? "Duplicating…" : "Duplicate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 hover:bg-white/5 cursor-pointer" onClick={() => setLocation(`/projects/${project.id}/export`)}>
                              <Download className="w-4 h-4" /> Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className="gap-2 text-red-400 hover:bg-red-500/10 cursor-pointer" onClick={() => { setDeleteTargetId(project.id); setDeleteTargetName(project.name); }}>
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate">{project.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-white/40">{project.width}×{project.height} · {project.fps}fps</p>
                        <p className="text-xs text-white/30">{format(new Date(project.updatedAt), "MMM d")}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* New project card */}
                <button
                  onClick={() => setLocation("/projects/new")}
                  className="rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/50 transition-colors flex flex-col items-center justify-center gap-3 p-8 text-white/30 hover:text-white/60 aspect-[4/3] sm:aspect-auto sm:min-h-52"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">New Project</span>
                </button>
              </div>
            )}
          </div>
        </main>

        <Watermark />

        <AlertDialog open={deleteTargetId !== null} onOpenChange={open => !open && setDeleteTargetId(null)}>
          <AlertDialogContent className="bg-[#111118] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTargetName}"?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/50">
                This will permanently delete the project and all its frames. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-500 text-white border-0">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  