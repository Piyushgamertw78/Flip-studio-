import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Film, Clock, Download, LayoutGrid, LogOut, PenLine, Trash2, Copy, ExternalLink, MoreVertical, Settings } from "lucide-react";
import { format } from "date-fns";
import {
  useListProjects,
  useGetDashboardStats,
  useDeleteProject,
  useDuplicateProject,
  getListProjectsQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Watermark } from "@/components/watermark";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects, isLoading: projectsLoading } = useListProjects(
    undefined,
    { query: { queryKey: getListProjectsQueryKey() } }
  );
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });

  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const handleDeleteConfirm = async () => {
    if (deleteTargetId === null) return;
    await deleteProject.mutateAsync({ projectId: deleteTargetId });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    setDeleteTargetId(null);
  };

  const handleDuplicate = async (projectId: number) => {
    setDuplicatingId(projectId);
    try {
      await duplicateProject.mutateAsync({ projectId });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } finally {
      setDuplicatingId(null);
    }
  };

  const STAT_CARDS = [
    {
      label: "Total Projects",
      value: stats?.totalProjects ?? 0,
      icon: <LayoutGrid className="w-5 h-5 text-primary" />,
      sub: "In your workspace",
    },
    {
      label: "Total Frames",
      value: stats?.totalFrames ?? 0,
      icon: <Film className="w-5 h-5 text-violet-400" />,
      sub: "Drawn across all projects",
    },
    {
      label: "Exports",
      value: stats?.totalExports ?? 0,
      icon: <Download className="w-5 h-5 text-pink-400" />,
      sub: "Rendered animations",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Film className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground">FlipStudio</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Professional 2D Animation</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 hidden sm:flex" onClick={() => setLocation("/whiteboard")}>
              <PenLine className="w-4 h-4" /> Whiteboard
            </Button>
            <Button size="sm" onClick={() => setLocation("/projects/new")} className="gap-2">
              <Plus className="w-4 h-4" /> New Project
            </Button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground max-w-[140px] truncate">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{user.username[0]?.toUpperCase()}</span>
                    </div>
                    <span className="hidden sm:inline truncate">{user.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email || user.username}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onClick={() => setLocation("/settings")}>
                    <Settings className="w-4 h-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={logout}>
                    <LogOut className="w-4 h-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Stats */}
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STAT_CARDS.map((s) => (
              <Card key={s.label} className="bg-card border-border relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-6 translate-x-6" />
                <CardHeader className="pb-1 pt-5">
                  <CardDescription className="font-medium text-muted-foreground flex items-center gap-2">
                    {s.icon} {s.label}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold">{s.value}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Projects grid */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Your Projects</h2>
            <Button variant="outline" size="sm" className="gap-2 sm:hidden" onClick={() => setLocation("/whiteboard")}>
              <PenLine className="w-4 h-4" /> Whiteboard
            </Button>
          </div>

          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group relative cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 overflow-hidden"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                >
                  {/* Thumbnail */}
                  <div
                    className="aspect-video w-full relative overflow-hidden border-b border-border"
                    style={{ backgroundColor: project.backgroundColor ?? "#ffffff" }}
                  >
                    {project.thumbnailData ? (
                      <img src={project.thumbnailData} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="w-10 h-10 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); setLocation(`/projects/${project.id}`); }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Button>
                    </div>
                  </div>

                  {/* Card info */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold line-clamp-1 flex-1">{project.name}</h3>
                      {/* Actions menu — stops propagation so card click isn't triggered */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem className="gap-2" onClick={() => setLocation(`/projects/${project.id}`)}>
                            <ExternalLink className="w-3.5 h-3.5" /> Open Studio
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => setLocation(`/projects/${project.id}/export`)}>
                            <Download className="w-3.5 h-3.5" /> Export
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={duplicatingId === project.id}
                            onClick={() => handleDuplicate(project.id)}
                          >
                            <Copy className={cn("w-3.5 h-3.5", duplicatingId === project.id && "animate-spin")} />
                            {duplicatingId === project.id ? "Duplicating..." : "Duplicate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => { setDeleteTargetId(project.id); setDeleteTargetName(project.name); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(project.updatedAt), "MMM d")}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{project.fps} fps</Badge>
                        {project.frameCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{project.frameCount}f</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* New project card */}
              <button
                className="aspect-auto h-full min-h-[200px] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                onClick={() => setLocation("/projects/new")}
              >
                <div className="w-12 h-12 rounded-full border-2 border-current flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium">New Project</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-28 bg-card rounded-xl border border-dashed border-border flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Film className="w-10 h-10 text-primary/60" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-xs">Create your first animation project to get started with FlipStudio.</p>
              <Button onClick={() => setLocation("/projects/new")} className="gap-2">
                <Plus className="w-4 h-4" /> Create First Project
              </Button>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground/40 select-none">FlipStudio — Professional 2D Animation Studio</p>
      </footer>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTargetName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its frames, layers, and exports. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleDeleteConfirm}
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Watermark />
    </div>
  );
}
