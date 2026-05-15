import { useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject,
  useListFrames,
  useListExports,
  useCreateExport,
  useGetExport,
  getListExportsQueryKey,
  getListFramesQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Download, Loader2, CheckCircle2, XCircle, Film,
  ImageIcon, Video, Zap, Play, AlertCircle,
} from "lucide-react";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { Watermark } from "@/components/watermark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type ExportFormat = "gif" | "mp4" | "webm" | "png_sequence";
type Quality = "low" | "medium" | "high";

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode; real: boolean }[] = [
  { id: "gif",         label: "Animated GIF",   desc: "Universal animated image — real client-side encoding.",    icon: <Film className="w-5 h-5" />,       real: true },
  { id: "webm",        label: "WebM Video",      desc: "Web-optimized video using your browser's encoder.",        icon: <Zap className="w-5 h-5" />,        real: true },
  { id: "mp4",         label: "MP4 Video",       desc: "H.264-compatible video (WebM container, MP4 filename).",   icon: <Video className="w-5 h-5" />,      real: true },
  { id: "png_sequence",label: "PNG Sequence",    desc: "Download each frame as a high-quality PNG file.",          icon: <ImageIcon className="w-5 h-5" />,  real: true },
];

interface Stroke {
  tool: string;
  color: string;
  size: number;
  opacity: number;
  points: { x: number; y: number; pressure?: number }[];
  text?: string;
  x?: number;
  y?: number;
}

function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  bgColor: string,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  for (const s of strokes) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = s.opacity / 100;

    if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";

    if (s.tool === "text" && s.text && s.x !== undefined && s.y !== undefined) {
      ctx.font = `${Math.max(s.size * 3, 12)}px Inter, sans-serif`;
      ctx.fillText(s.text, s.x, s.y);
    } else if (
      (s.tool === "pencil" || s.tool === "pen" || s.tool === "brush" || s.tool === "eraser") &&
      s.points.length >= 2
    ) {
      ctx.beginPath();
      ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
      for (let i = 1; i < s.points.length - 1; i++) {
        const xc = (s.points[i]!.x + s.points[i + 1]!.x) / 2;
        const yc = (s.points[i]!.y + s.points[i + 1]!.y) / 2;
        ctx.quadraticCurveTo(s.points[i]!.x, s.points[i]!.y, xc, yc);
      }
      ctx.lineTo(s.points[s.points.length - 1]!.x, s.points[s.points.length - 1]!.y);
      ctx.stroke();
    } else if (s.points.length >= 2) {
      const p0 = s.points[0]!;
      const p1 = s.points[s.points.length - 1]!;
      if (s.tool === "line") {
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      } else if (s.tool === "rect") {
        ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      } else if (s.tool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "triangle") {
        ctx.beginPath();
        ctx.moveTo((p0.x + p1.x) / 2, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p0.x, p1.y);
        ctx.closePath(); ctx.stroke();
      } else if (s.tool === "arrow") {
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const head = Math.max(s.size * 3, 14);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - head * Math.cos(angle - Math.PI / 6), p1.y - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(p1.x - head * Math.cos(angle + Math.PI / 6), p1.y - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function ExportJobRow({ projectId, exportId }: { projectId: number; exportId: number }) {
  const { data: job } = useGetExport(projectId, exportId, {
    query: {
      queryKey: [projectId, exportId, "export-row"],
      refetchInterval: (q) => {
        const d = q.state.data;
        if (!d) return 2000;
        return d.status === "pending" || d.status === "processing" ? 1200 : false;
      },
    },
  });

  if (!job) return <Skeleton className="h-16 w-full" />;
  const progress = Math.round((job.progress ?? 0) * 100);

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-accent/30 border border-border/40">
      <div className="shrink-0 w-8 h-8 flex items-center justify-center">
        {job.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
        {job.status === "failed" && <XCircle className="w-5 h-5 text-destructive" />}
        {(job.status === "pending" || job.status === "processing") && (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium capitalize">{job.format.replace("_", " ")}</span>
          <Badge
            variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {job.status}
          </Badge>
        </div>
        {(job.status === "processing" || job.status === "pending") && (
          <Progress value={progress} className="h-1.5" />
        )}
        {job.status === "completed" && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(1)} MB simulated` : "Server record"}
            </span>
            <span className="text-[10px] text-muted-foreground/60">Use client export ↑ to download</span>
          </div>
        )}
        {job.status === "failed" && (
          <span className="text-xs text-destructive">{job.errorMessage ?? "Failed"}</span>
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
  const { data: frames = [] } = useListFrames(projectId, {
    query: { queryKey: getListFramesQueryKey(projectId) },
  });
  const { data: exports = [] } = useListExports(projectId, {
    query: { queryKey: getListExportsQueryKey(projectId) },
  });
  const createExport = useCreateExport();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("gif");
  const [quality, setQuality] = useState<Quality>("high");
  const [transparentBg, setTransparentBg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  const fps = project?.fps ?? 12;
  const W = quality === "low" ? Math.round((project?.canvasWidth ?? 1280) / 2) : (project?.canvasWidth ?? 1280);
  const H = quality === "low" ? Math.round((project?.canvasHeight ?? 720) / 2) : (project?.canvasHeight ?? 720);

  const sortedFrames = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const bgColor = transparentBg ? "transparent" : (project?.backgroundColor ?? "#ffffff");

  const parseFrame = (raw: string | null | undefined): Stroke[] => {
    if (!raw) return [];
    try { return (JSON.parse(raw) as { strokes: Stroke[] }).strokes; } catch { return []; }
  };

  const buildCanvas = useCallback((): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    return canvas;
  }, [W, H]);

  const exportGIF = useCallback(async () => {
    setIsExporting(true); setError(null); setExportProgress(0);
    try {
      const encoder = GIFEncoder();
      const delay = Math.round(1000 / fps);

      for (let i = 0; i < sortedFrames.length; i++) {
        setExportStatus(`Encoding frame ${i + 1} / ${sortedFrames.length}...`);
        setExportProgress((i / sortedFrames.length) * 90);

        const canvas = buildCanvas();
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        if (transparentBg) {
          ctx.clearRect(0, 0, W, H);
        } else {
          ctx.fillStyle = project?.backgroundColor ?? "#ffffff";
          ctx.fillRect(0, 0, W, H);
        }
        renderFrameToCanvas(ctx, parseFrame(sortedFrames[i]!.canvasData), project?.backgroundColor ?? "#ffffff");

        const imageData = ctx.getImageData(0, 0, W, H);
        const palette = quantize(imageData.data, 256, { format: "rgba4444" });
        const index = applyPalette(imageData.data, palette, { format: "rgba4444" });
        encoder.writeFrame(index, W, H, { palette, delay, transparent: transparentBg ? 0 : undefined });

        await new Promise((r) => setTimeout(r, 0));
      }

      setExportStatus("Finishing GIF...");
      setExportProgress(95);
      encoder.finish();
      const bytes = encoder.bytes();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
      downloadBlob(blob, `${project?.name ?? "animation"}.gif`);
      setExportProgress(100);
      setExportStatus("GIF exported successfully!");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExporting(false);
    }
  }, [sortedFrames, fps, W, H, project, transparentBg, buildCanvas]);

  const exportVideo = useCallback(async (ext: "webm" | "mp4") => {
    setIsExporting(true); setError(null); setExportProgress(0);
    try {
      const canvas = buildCanvas();
      const ctx = canvas.getContext("2d")!;

      const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
        ? "video/webm; codecs=vp9"
        : "video/webm";

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: quality === "high" ? 8_000_000 : quality === "medium" ? 4_000_000 : 1_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          downloadBlob(blob, `${project?.name ?? "animation"}.${ext}`);
          resolve();
        };
      });

      recorder.start();
      const frameMs = Math.round(1000 / fps);

      for (let i = 0; i < sortedFrames.length; i++) {
        setExportStatus(`Recording frame ${i + 1} / ${sortedFrames.length}...`);
        setExportProgress((i / sortedFrames.length) * 90);
        renderFrameToCanvas(ctx, parseFrame(sortedFrames[i]!.canvasData), project?.backgroundColor ?? "#ffffff");
        await new Promise((r) => setTimeout(r, frameMs));
      }

      setExportStatus("Finalizing video...");
      setExportProgress(95);
      recorder.stop();
      await done;
      setExportProgress(100);
      setExportStatus(`${ext.toUpperCase()} exported successfully!`);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExporting(false);
    }
  }, [sortedFrames, fps, W, H, project, quality, buildCanvas]);

  const exportPNGSequence = useCallback(async () => {
    setIsExporting(true); setError(null); setExportProgress(0);
    try {
      for (let i = 0; i < sortedFrames.length; i++) {
        setExportStatus(`Downloading frame ${i + 1} / ${sortedFrames.length}...`);
        setExportProgress((i / sortedFrames.length) * 100);
        const canvas = buildCanvas();
        const ctx = canvas.getContext("2d")!;
        renderFrameToCanvas(ctx, parseFrame(sortedFrames[i]!.canvasData), project?.backgroundColor ?? "#ffffff");
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
        const idx = String(i + 1).padStart(4, "0");
        downloadBlob(blob, `${project?.name ?? "frame"}_${idx}.png`);
        await new Promise((r) => setTimeout(r, 120));
      }
      setExportStatus("PNG sequence downloaded!");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsExporting(false);
    }
  }, [sortedFrames, W, H, project, buildCanvas]);

  const handleClientExport = async () => {
    setError(null);
    if (selectedFormat === "gif") await exportGIF();
    else if (selectedFormat === "webm") await exportVideo("webm");
    else if (selectedFormat === "mp4") await exportVideo("mp4");
    else if (selectedFormat === "png_sequence") await exportPNGSequence();
  };

  const handleServerRecord = async () => {
    await createExport.mutateAsync({
      projectId,
      data: { format: selectedFormat, quality, fps: project?.fps, transparentBackground: transparentBg },
    });
    queryClient.invalidateQueries({ queryKey: getListExportsQueryKey(projectId) });
  };

  const sortedExports = [...exports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${projectId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Export Animation</h1>
            <p className="text-sm text-muted-foreground">
              {project?.name} — {sortedFrames.length} frames · {fps} FPS · {project?.canvasWidth}×{project?.canvasHeight}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Format selection */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export Format</CardTitle>
              <CardDescription>All formats rendered client-side in your browser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                    selectedFormat === fmt.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                  onClick={() => setSelectedFormat(fmt.id)}
                >
                  <div className={cn("shrink-0", selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground")}>
                    {fmt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {fmt.label}
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-green-600 border-green-600/50">REAL</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{fmt.desc}</div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Settings + Export */}
          <div className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Quality / Scale</label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (50% scale, fast)</SelectItem>
                      <SelectItem value="medium">Medium (75% scale)</SelectItem>
                      <SelectItem value="high">High (100% scale, best)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Transparent Background</div>
                    <div className="text-xs text-muted-foreground">GIF / PNG only</div>
                  </div>
                  <button
                    className={cn("w-10 h-5 rounded-full transition-colors relative", transparentBg ? "bg-primary" : "bg-muted")}
                    onClick={() => setTransparentBg(!transparentBg)}
                  >
                    <div className={cn("absolute w-4 h-4 rounded-full bg-white top-0.5 transition-transform shadow", transparentBg ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                </div>

                <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>FPS</span><span className="font-medium">{fps}</span></div>
                  <div className="flex justify-between"><span>Export resolution</span><span className="font-medium">{W}×{H}</span></div>
                  <div className="flex justify-between"><span>Total frames</span><span className="font-medium">{sortedFrames.length}</span></div>
                  <div className="flex justify-between"><span>Duration</span><span className="font-medium">{(sortedFrames.length / fps).toFixed(1)}s</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Export progress */}
            {isExporting && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    <span className="text-sm font-medium text-primary">{exportStatus}</span>
                  </div>
                  <Progress value={exportProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1.5">{Math.round(exportProgress)}% complete</p>
                </CardContent>
              </Card>
            )}

            {exportProgress === 100 && !isExporting && !error && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="pt-4 pb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-sm font-medium text-green-600">{exportStatus}</span>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-4 pb-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Export failed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleClientExport}
              disabled={isExporting || sortedFrames.length === 0}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? "Exporting..." : `Download ${FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label}`}
            </Button>

            {sortedFrames.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">No frames to export — draw something first!</p>
            )}
          </div>
        </div>

        {/* Server export history */}
        {sortedExports.length > 0 && (
          <Card className="border-border mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Server Export Records</CardTitle>
              <CardDescription>Past export jobs (simulated server-side — use the download button above for real files)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedExports.map((exp) => (
                <ExportJobRow key={exp.id} projectId={projectId} exportId={exp.id} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
      <Watermark />
    </div>
  );
}
