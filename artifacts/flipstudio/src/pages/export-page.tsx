import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject,
  useListExports,
  useCreateExport,
  useGetExport,
  getListExportsQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Download, Loader2, CheckCircle2, XCircle, Film,
  ImageIcon, Video, Zap,
} from "lucide-react";
import { Watermark } from "@/components/watermark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type ExportFormat = "gif" | "mp4" | "png_sequence" | "webm";
type Quality = "low" | "medium" | "high";

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "gif", label: "Animated GIF", desc: "Universal, shareable. Best for short loops.", icon: <Film className="w-5 h-5" /> },
  { id: "mp4", label: "MP4 Video", desc: "High quality video with audio support.", icon: <Video className="w-5 h-5" /> },
  { id: "webm", label: "WebM", desc: "Web-optimized video format.", icon: <Zap className="w-5 h-5" /> },
  { id: "png_sequence", label: "PNG Sequence", desc: "Full quality frames as individual files.", icon: <ImageIcon className="w-5 h-5" /> },
];

function ExportJobStatus({ projectId, exportId }: { projectId: number; exportId: number }) {
  const queryClient = useQueryClient();
  const { data: exportJob } = useGetExport(projectId, exportId, {
    query: {
      queryKey: [projectId, exportId, "export"],
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        return data.status === "pending" || data.status === "processing" ? 1500 : false;
      },
    },
  });

  if (!exportJob) return <Skeleton className="h-20 w-full" />;

  const progress = Math.round((exportJob.progress ?? 0) * 100);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-accent/30">
      <div className="shrink-0">
        {exportJob.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
        {exportJob.status === "failed" && <XCircle className="w-5 h-5 text-destructive" />}
        {(exportJob.status === "pending" || exportJob.status === "processing") && (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium capitalize">{exportJob.format.replace("_", " ")}</span>
          <Badge
            variant={exportJob.status === "completed" ? "default" : exportJob.status === "failed" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {exportJob.status}
          </Badge>
        </div>
        {(exportJob.status === "processing" || exportJob.status === "pending") && (
          <Progress value={progress} className="h-1.5" />
        )}
        {exportJob.status === "completed" && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {exportJob.fileSize ? `${(exportJob.fileSize / 1024 / 1024).toFixed(1)} MB` : "Ready"}
            </span>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1">
              <Download className="w-3 h-3" /> Download
            </Button>
          </div>
        )}
        {exportJob.status === "failed" && (
          <span className="text-xs text-destructive">{exportJob.errorMessage ?? "Export failed"}</span>
        )}
      </div>
    </div>
  );
}

export default function ExportPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: exports = [] } = useListExports(projectId, {
    query: { queryKey: getListExportsQueryKey(projectId) },
  });
  const createExport = useCreateExport();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("gif");
  const [quality, setQuality] = useState<Quality>("high");
  const [transparentBg, setTransparentBg] = useState(false);

  const handleExport = async () => {
    await createExport.mutateAsync({
      projectId,
      data: {
        format: selectedFormat,
        quality,
        fps: project?.fps,
        transparentBackground: transparentBg,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListExportsQueryKey(projectId) });
  };

  const sortedExports = [...exports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${projectId}`)} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Export</h1>
            <p className="text-sm text-muted-foreground">{project?.name} — {project?.frameCount ?? 0} frames</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Format selection */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Format</CardTitle>
              <CardDescription>Choose your export format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                    selectedFormat === fmt.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedFormat(fmt.id)}
                  data-testid={`format-${fmt.id}`}
                >
                  <div className={cn("shrink-0", selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground")}>
                    {fmt.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{fmt.label}</div>
                    <div className="text-xs text-muted-foreground">{fmt.desc}</div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Settings */}
          <div className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Quality</label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                    <SelectTrigger data-testid="select-quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Fast)</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (Best)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Transparent Background</div>
                    <div className="text-xs text-muted-foreground">PNG sequence / WebM only</div>
                  </div>
                  <button
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      transparentBg ? "bg-primary" : "bg-muted"
                    )}
                    onClick={() => setTransparentBg(!transparentBg)}
                    data-testid="toggle-transparent-bg"
                  >
                    <div className={cn(
                      "absolute w-4 h-4 rounded-full bg-white top-0.5 transition-transform shadow",
                      transparentBg ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>FPS</span><span>{project?.fps ?? 12}</span></div>
                    <div className="flex justify-between"><span>Resolution</span><span>{project?.canvasWidth}x{project?.canvasHeight}</span></div>
                    <div className="flex justify-between"><span>Frames</span><span>{project?.frameCount}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleExport}
              disabled={createExport.isPending}
              data-testid="button-start-export"
            >
              {createExport.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export {FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label}
            </Button>
          </div>
        </div>

        {/* Export history */}
        {sortedExports.length > 0 && (
          <Card className="border-border mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedExports.map((exp) => (
                <ExportJobStatus key={exp.id} projectId={projectId} exportId={exp.id} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
      <Watermark />
    </div>
  );
}
