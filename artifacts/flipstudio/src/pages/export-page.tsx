import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Loader2, Film, ImageIcon, Video, Zap, Play, CheckCircle2 } from "lucide-react";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { Watermark } from "@/components/watermark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { db, type Project, type Frame, type Layer } from "@/lib/local-db";

type ExportFormat = "gif" | "webm" | "png_sequence";
type Quality = "low" | "medium" | "high";

interface Stroke { tool: string; color: string; size: number; opacity: number; points: { x: number; y: number; pressure: number }[]; text?: string; textX?: number; textY?: number; }

const QUALITY_SCALE: Record<Quality, number> = { low: 0.5, medium: 0.75, high: 1 };

function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  for (const s of strokes) {
    ctx.globalAlpha = (s.opacity ?? 100) / 100;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineWidth = s.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
    if (s.tool === "eraser") ctx.globalAlpha = 1;
    if (s.tool === "fill") { ctx.globalCompositeOperation = "source-over"; ctx.fillRect(0,0,w,h); }
    else if (s.tool === "text" && s.text && s.textX !== undefined && s.textY !== undefined) {
      ctx.globalCompositeOperation = "source-over";
      ctx.font = (s.size * 5) + "px Inter, sans-serif";
      ctx.fillText(s.text, s.textX * w, s.textY * h);
    } else if (s.tool === "line" && s.points.length >= 2) {
      const p0 = s.points[0]!, p1 = s.points[s.points.length-1]!;
      ctx.beginPath(); ctx.moveTo(p0.x*w, p0.y*h); ctx.lineTo(p1.x*w, p1.y*h); ctx.stroke();
    } else if (s.tool === "rect" && s.points.length >= 2) {
      const p0 = s.points[0]!, p1 = s.points[s.points.length-1]!;
      ctx.strokeRect(p0.x*w, p0.y*h, (p1.x-p0.x)*w, (p1.y-p0.y)*h);
    } else if (s.tool === "ellipse" && s.points.length >= 2) {
      const p0 = s.points[0]!, p1 = s.points[s.points.length-1]!;
      const cx=(p0.x+p1.x)/2*w, cy=(p0.y+p1.y)/2*h, rx=Math.abs(p1.x-p0.x)/2*w, ry=Math.abs(p1.y-p0.y)/2*h;
      ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2); ctx.stroke();
    } else if (["pencil","pen","brush"].includes(s.tool) && s.points.length > 0) {
      ctx.lineWidth = s.tool === "brush" ? s.size * 2.5 : s.size;
      if (s.tool === "brush") ctx.globalAlpha = (s.opacity/100)*0.6;
      ctx.beginPath(); ctx.moveTo(s.points[0]!.x*w, s.points[0]!.y*h);
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i]!, q = s.points[i-1]!;
        ctx.quadraticCurveTo(q.x*w, q.y*h, (q.x+p.x)/2*w, (q.y+p.y)/2*h);
      }
      const last = s.points[s.points.length-1]!;
      ctx.lineTo(last.x*w, last.y*h); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
}

function compositeFrame(canvas: HTMLCanvasElement, layers: Layer[], bgColor: string) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = bgColor; ctx.fillRect(0,0,w,h);
  const sorted = [...layers].sort((a,b)=>a.order-b.order);
  for (const layer of sorted) {
    if (!layer.visible) continue;
    try {
      const data = JSON.parse(layer.canvasData) as { strokes: Stroke[] };
      if (!data.strokes?.length) continue;
      const tmp = document.createElement("canvas"); tmp.width=w; tmp.height=h;
      renderStrokes(tmp.getContext("2d")!, data.strokes, w, h);
      ctx.globalAlpha = layer.opacity / 100;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    } catch {}
  }
}

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [frames, setFrames]   = useState<Frame[]>([]);
  const [format, setFormat]   = useState<ExportFormat>("gif");
  const [quality, setQuality] = useState<Quality>("medium");
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [done, setDone]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const load = async () => {
      const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
      setProject(proj ?? null);
      setFrames(fs);
      setLoading(false);
    };
    void load();
  }, [projectId]);

  const exportAnimation = useCallback(async () => {
    if (!project || !frames.length) return;
    setExporting(true); setDone(false); setProgress(0);

    const scale = QUALITY_SCALE[quality];
    const W = Math.round(project.width * scale);
    const H = Math.round(project.height * scale);
    const fps = project.fps;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = W; canvas.height = H;

    try {
      if (format === "png_sequence") {
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]!;
          const layers = await db.layers.listByFrame(frame.id);
          compositeFrame(canvas, layers, project.backgroundColor);
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = "frame_" + String(i+1).padStart(4,"0") + ".png";
          a.click();
          setProgress(Math.round((i+1)/frames.length*100));
          await new Promise(r => setTimeout(r, 50));
        }
      } else if (format === "gif") {
        const encoder = GIFEncoder();
        const delay = Math.round(1000 / fps);
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]!;
          const layers = await db.layers.listByFrame(frame.id);
          compositeFrame(canvas, layers, project.backgroundColor);
          const ctx = canvas.getContext("2d")!;
          const imageData = ctx.getImageData(0, 0, W, H);
          const palette = quantize(imageData.data, 256);
          const index = applyPalette(imageData.data, palette);
          encoder.writeFrame(index, W, H, { palette, delay });
          setProgress(Math.round((i+1)/frames.length*80));
        }
        encoder.finish();
        const buf = encoder.bytes();
        const blob = new Blob([buf], { type: "image/gif" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = (project.name || "animation") + ".gif"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setProgress(100);
      } else {
        // WebM / MP4 via MediaRecorder
        const stream = canvas.captureStream(fps);
        const supported = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
        if (!supported) throw new Error("Video recording not supported in this browser");
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, { mimeType: supported });
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        const finishPromise = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
        recorder.start();
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i]!;
          const layers = await db.layers.listByFrame(frame.id);
          compositeFrame(canvas, layers, project.backgroundColor);
          setProgress(Math.round((i+1)/frames.length*80));
          await new Promise(r => setTimeout(r, 1000/fps));
        }
        recorder.stop();
        await finishPromise;
        const blob = new Blob(chunks, { type: supported });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (project.name || "animation") + (format === "mp4" ? ".mp4" : ".webm");
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setProgress(100);
      }
      setDone(true);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }, [project, frames, format, quality]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#080811]">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"/>
    </div>
  );
  if (!project) return null;

  const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { id:"gif",          label:"Animated GIF",  icon:<Film className="w-4 h-4"/>,     desc:"Universal — works everywhere" },
    { id:"webm",         label:"WebM / MP4",    icon:<Video className="w-4 h-4"/>,    desc:"Video with browser encoder" },
    { id:"png_sequence", label:"PNG Sequence",  icon:<ImageIcon className="w-4 h-4"/>,desc:"Each frame as PNG" },
  ];

  return (
    <div className="min-h-screen bg-[#080811] text-white flex flex-col">
      <div className="h-12 border-b border-white/[0.07] bg-[#0e0e1a] flex items-center px-3 gap-2 shrink-0">
        <button className="w-8 h-8 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          onClick={()=>setLocation("/projects/"+projectId)}>
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <span className="font-bold text-sm text-white/90">Export — {project.name}</span>
        <span className="text-xs text-white/30 ml-2">{frames.length} frame{frames.length!==1?"s":""} · {project.width}×{project.height} · {project.fps}fps</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          {/* Format selection */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Format</p>
            <div className="space-y-2">
              {formats.map(f => (
                <button key={f.id}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                    format===f.id?"border-violet-500/50 bg-violet-600/10":"border-white/8 hover:border-white/15 hover:bg-white/3")}
                  onClick={()=>{setFormat(f.id);setDone(false);}}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",format===f.id?"bg-violet-600 text-white":"bg-white/5 text-white/40")}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-xs text-white/35">{f.desc}</p>
                  </div>
                  {format===f.id && <div className="ml-auto w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full"/></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Quality</p>
            <div className="flex gap-2">
              {(["low","medium","high"] as Quality[]).map(q => (
                <button key={q}
                  className={cn("flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all",
                    quality===q?"border-violet-500/50 bg-violet-600/10 text-violet-300":"border-white/8 text-white/40 hover:border-white/15")}
                  onClick={()=>{setQuality(q);setDone(false);}}>
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-1.5">
              Output: {Math.round(project.width*QUALITY_SCALE[quality])}×{Math.round(project.height*QUALITY_SCALE[quality])}px
            </p>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="bg-white/3 border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Exporting…</span>
                <span className="text-sm font-bold text-violet-400">{progress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-300" style={{width:progress+"%"}}/>
              </div>
            </div>
          )}

          {done && !exporting && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0"/>
              <span className="text-sm text-green-300">Export complete! Check your downloads.</span>
            </div>
          )}

          <Button
            onClick={exportAnimation}
            disabled={exporting}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-bold text-base rounded-xl shadow-lg shadow-violet-900/30"
          >
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Exporting…</> : <><Download className="w-4 h-4 mr-2"/>Export Animation</>}
          </Button>

          <canvas ref={canvasRef} className="hidden"/>
        </div>
      </div>
      <Watermark/>
    </div>
  );
}
