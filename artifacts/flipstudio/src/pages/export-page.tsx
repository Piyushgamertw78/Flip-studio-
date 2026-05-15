import { useState, useRef, useCallback, useEffect } from "react";
  import { useParams, useLocation } from "wouter";
  import { ArrowLeft, Download, Loader2, Film, ImageIcon, Video, Zap, Play, CheckCircle2 } from "lucide-react";
  import { GIFEncoder, quantize, applyPalette } from "gifenc";
  import { Watermark } from "@/components/watermark";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Progress } from "@/components/ui/progress";
  import { Badge } from "@/components/ui/badge";
  import { Skeleton } from "@/components/ui/skeleton";
  import { cn } from "@/lib/utils";
  import { db, type Project, type Frame } from "@/lib/local-db";

  type ExportFormat = "gif" | "mp4" | "webm" | "png_sequence";
  type Quality = "low" | "medium" | "high";

  const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: "gif",          label: "Animated GIF",   desc: "Universal animated image — real client-side encoding.",   icon: <Film className="w-5 h-5" /> },
    { id: "webm",         label: "WebM Video",      desc: "Web-optimized video using your browser's MediaRecorder.", icon: <Zap className="w-5 h-5" /> },
    { id: "mp4",          label: "MP4 Video",       desc: "H.264-compatible video (WebM stream, .mp4 filename).",    icon: <Video className="w-5 h-5" /> },
    { id: "png_sequence", label: "PNG Sequence",    desc: "Download each frame as a high-quality PNG.",             icon: <ImageIcon className="w-5 h-5" /> },
  ];

  const QUALITY_SCALE: Record<Quality, number> = { low: 0.5, medium: 0.75, high: 1 };

  interface Stroke { tool: string; color: string; size: number; opacity: number; points: { x: number; y: number; pressure: number }[]; text?: string; x?: number; y?: number; }

  function renderFrame(canvas: HTMLCanvasElement, frame: Frame, project: Project) {
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    try {
      const data = JSON.parse(frame.canvasData) as { strokes: Stroke[] };
      for (const s of (data.strokes ?? [])) {
        if (!s.points?.length) continue;
        ctx.globalAlpha = (s.opacity ?? 100) / 100;
        ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
        ctx.lineWidth = s.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (s.tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1; }
        else ctx.globalCompositeOperation = "source-over";
        if (s.tool === "fill") { ctx.fillRect(0, 0, w, h); }
        else if (["pencil","pen","brush"].includes(s.tool) && s.points.length > 0) {
          ctx.lineWidth = s.tool === "brush" ? s.size * 2 : s.size;
          ctx.beginPath(); ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
          for (let i = 1; i < s.points.length; i++) {
            const p = s.points[i]!, q = s.points[i-1]!;
            ctx.quadraticCurveTo(q.x*w, q.y*h, (q.x+p.x)/2*w, (q.y+p.y)/2*h);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    } catch {}
  }

  export default function ExportPage() {
    const { id } = useParams<{ id: string }>();
    const projectId = Number(id);
    const [, setLocation] = useLocation();

    const [project, setProject] = useState<Project | null>(null);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [loading, setLoading] = useState(true);

    const [format, setFormat] = useState<ExportFormat>("gif");
    const [quality, setQuality] = useState<Quality>("medium");
    const [fps, setFps] = useState(12);
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);
    const offscreenRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const load = async () => {
        const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
        if (!proj) { setLocation("/"); return; }
        setProject(proj);
        setFrames(fs);
        setFps(proj.fps);
        setLoading(false);
      };
      void load();
    }, [projectId]);

    useEffect(() => {
      if (!project) return;
      const scale = QUALITY_SCALE[quality];
      const w = Math.round(project.width * scale);
      const h = Math.round(project.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      offscreenRef.current = c;
    }, [project, quality]);

    const exportGIF = useCallback(async () => {
      if (!project || !offscreenRef.current) return;
      const canvas = offscreenRef.current;
      const encoder = GIFEncoder();
      const delay = Math.round(1000 / fps);
      for (let i = 0; i < frames.length; i++) {
        renderFrame(canvas, frames[i]!, project);
        const ctx = canvas.getContext("2d")!;
        const raw = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = quantize(raw.data, 256);
        const index = applyPalette(raw.data, palette);
        encoder.writeFrame(index, canvas.width, canvas.height, { palette, delay });
        setProgress(Math.round(((i + 1) / frames.length) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
      encoder.finish();
      const blob = new Blob([encoder.bytes()], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${project.name}.gif`; a.click();
      URL.revokeObjectURL(url);
    }, [project, frames, fps]);

    const exportPNGSequence = useCallback(async () => {
      if (!project || !offscreenRef.current) return;
      for (let i = 0; i < frames.length; i++) {
        renderFrame(offscreenRef.current, frames[i]!, project);
        const blob = await new Promise<Blob>(r => offscreenRef.current!.toBlob(b => r(b!), "image/png"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${project.name}_frame_${String(i + 1).padStart(4, "0")}.png`; a.click();
        URL.revokeObjectURL(url);
        setProgress(Math.round(((i + 1) / frames.length) * 100));
        await new Promise(r => setTimeout(r, 50));
      }
    }, [project, frames]);

    const exportVideo = useCallback(async (ext: "webm" | "mp4") => {
      if (!project || !offscreenRef.current) return;
      const canvas = offscreenRef.current;
      if (!("captureStream" in canvas)) { alert("Your browser doesn't support video export. Try Chrome."); return; }
      const stream = (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(fps);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: quality === "high" ? 8_000_000 : quality === "medium" ? 4_000_000 : 1_500_000 });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<void>(res => { recorder.onstop = () => res(); });
      recorder.start();
      for (let i = 0; i < frames.length; i++) {
        renderFrame(canvas, frames[i]!, project);
        setProgress(Math.round(((i + 1) / frames.length) * 100));
        await new Promise(r => setTimeout(r, 1000 / fps));
      }
      recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${project.name}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    }, [project, frames, fps, quality]);

    const handleExport = async () => {
      setExporting(true); setProgress(0); setDone(false);
      try {
        if (format === "gif") await exportGIF();
        else if (format === "png_sequence") await exportPNGSequence();
        else await exportVideo(format === "mp4" ? "mp4" : "webm");
        setDone(true);
      } finally { setExporting(false); }
    };

    if (loading) return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#050508]">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );

    if (!project) return null;

    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#050508]/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/5" onClick={() => setLocation(`/projects/${projectId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">Export — {project.name}</h1>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Frames", value: frames.length },
              { label: "Canvas", value: `${project.width}×${project.height}` },
              { label: "FPS", value: project.fps },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Format */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-3"><CardTitle className="text-base">Export Format</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {FORMAT_OPTIONS.map(f => (
                <button
                  key={f.id}
                  className={cn("w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left", format === f.id ? "border-violet-500 bg-violet-600/10" : "border-white/10 hover:border-white/20 hover:bg-white/5")}
                  onClick={() => setFormat(f.id)}
                >
                  <div className={cn("p-2 rounded-lg shrink-0", format === f.id ? "bg-violet-600/20 text-violet-400" : "bg-white/5 text-white/40")}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{f.desc}</p>
                  </div>
                  {format === f.id && <CheckCircle2 className="w-4 h-4 text-violet-400 ml-auto shrink-0 mt-0.5" />}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-3"><CardTitle className="text-base">Settings</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Quality</label>
                <Select value={quality} onValueChange={v => setQuality(v as Quality)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10 text-white">
                    <SelectItem value="low" className="hover:bg-white/5 focus:bg-white/5">Low (50%)</SelectItem>
                    <SelectItem value="medium" className="hover:bg-white/5 focus:bg-white/5">Medium (75%)</SelectItem>
                    <SelectItem value="high" className="hover:bg-white/5 focus:bg-white/5">High (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Frame Rate</label>
                <Select value={String(fps)} onValueChange={v => setFps(Number(v))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#111118] border-white/10 text-white">
                    {[8, 12, 15, 24, 30].map(f => (
                      <SelectItem key={f} value={String(f)} className="hover:bg-white/5 focus:bg-white/5">{f} fps</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {exporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/60">
                <span>Encoding {format.toUpperCase()}…</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-600 [&>div]:to-fuchsia-600" />
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" /> <span className="text-sm">Export complete! Check your downloads folder.</span>
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={exporting || frames.length === 0}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-semibold text-base"
          >
            {exporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting…</> : <><Download className="w-4 h-4 mr-2" /> Export {format.toUpperCase()}</>}
          </Button>
        </main>
        <Watermark />
      </div>
    );
  }
  