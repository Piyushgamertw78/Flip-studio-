import { useLocation } from "wouter";
import { Plus, Film, Clock, Download, ArrowRight, LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import { useListProjects, useGetDashboardStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col">
      <div className="max-w-7xl mx-auto space-y-8 flex-1 w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Film className="w-10 h-10 text-primary" />
              FlipStudio
            </h1>
            <p className="text-muted-foreground mt-2">Professional 2D Animation Studio</p>
          </div>
          <Button size="lg" onClick={() => setLocation("/projects/new")} className="gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </Button>
        </header>

        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-muted-foreground">Total Projects</CardDescription>
                <CardTitle className="text-3xl">{stats.totalProjects}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  In your workspace
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-muted-foreground">Total Frames</CardDescription>
                <CardTitle className="text-3xl">{stats.totalFrames}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Film className="w-4 h-4 mr-1" />
                  Drawn across all projects
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-muted-foreground">Exports</CardDescription>
                <CardTitle className="text-3xl">{stats.totalExports}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Download className="w-4 h-4 mr-1" />
                  Rendered animations
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">Recent Projects</h2>
          </div>
          
          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className="group cursor-pointer hover:border-primary/50 transition-colors duration-300 overflow-hidden"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                >
                  <div className="aspect-video w-full bg-muted border-b border-border relative overflow-hidden flex items-center justify-center">
                    {project.thumbnailData ? (
                      <img src={project.thumbnailData} alt={project.name} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-12 h-12 text-muted-foreground/30" />
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" className="gap-2">
                        Open Studio <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                    <CardDescription className="text-xs flex items-center justify-between mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(project.updatedAt), "MMM d, yyyy")}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {project.fps} FPS
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border flex flex-col items-center">
              <Film className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6">Create your first animation project to get started.</p>
              <Button onClick={() => setLocation("/projects/new")} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto w-full pt-8">
        <p className="text-center text-xs text-muted-foreground/50 select-none">
          Made By Piyush
        </p>
      </div>
    </div>
  );
}
