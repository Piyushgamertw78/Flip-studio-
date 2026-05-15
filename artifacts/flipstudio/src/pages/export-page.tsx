import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Loader2, Film, ImageIcon, Video, Play, CheckCircle2, Zap, Settings2, X } from "lucide-react";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { Watermark } from "@/components/watermark";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { db, type Project, type Frame, type Layer } from "@/lib/local-db";
import { compositeAllLayers, safeParseCanvas } from "@/lib/rendering";

type ExportFormat = "gif" | "webm" | "png_sequence" | "jpg_sequence" | "mp4";
type Quality = "low" | "medium" | "high" | "ultra";

const QUALITY_SCALE: Record<Quality, number> = { low: 0.4, medium: 0.65, high: 0.85, ultra: 1 };

function renderFrameToCanvas(canvas: HTMLCanvasElement, layers: Layer[], bgColor: string) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bgColor || "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const map = new Map(sorted.map(l => [l.id, safeParseCanvas(l.canvasData).strokes]));
  compositeAllLayers(ctx, sorted, map, w, h, bgColor || "#ffffff");
}

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [frames, setFrames]   = useState<Frame[]>([]);
  const [format, setFormat]   = useState<ExportFormat>("gif");
  const [quality, setQuality] = useState<Quality>("medium");
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(0);
  const [gifDither, setGifDither] = useState(false);
  const [loopGif, setLoopGif] = useState(true);
  const [transparentBg, setTransparentBg] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [done, setDone]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const load = async () => {
      const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
      setProject(proj ?? null);
      setFrames(fs);
      setEndFrame((fs.length - 1));
      setLoading(false);
    };
    void load();
  }, [projectId]);

  const exportAnimation = useCallback(async () => {
    if (!project || !frames.length) return;
    setExporting(true); setDone(false); setProgress(0); setProgressText("Preparing…");

    const scale = QUALITY_SCALE[quality];
    const W = Math.round(project.width * scale);
    const H = Math.round(project.height * scale);
    const fps = project.fps;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const bgColor = transparentBg ? "transparent" : project.backgroundColor;

    const selectedFrames = frames.slice(startFrame, endFrame + 1);

    try {
      if (format === "png_sequence" || format === "jpg_sequence") {
        for (let i = 0; i < selectedFrames.length; i++) {
          const frame = selectedFrames[i]!;
          setProgressText(`Exporting frame ${i + 1}/${selectedFrames.length}…`);
          const layers = await db.layers.listByFrame(frame.id);
          renderFrameToCanvas(canvas, layers, bgColor);
          const ext = format === "jpg_sequence" ? "jpg" : "png";
          const mime = format === "jpg_sequence" ? "image/jpeg" : "image/png";
          const qual = format === "jpg_sequence" ? 0.92 : undefined;
          const a = document.createElement("a");
          a.href = canvas.toDataURL(mime, qual);
          a.download = `${project.name}_frame_${String(i + startFrame + 1).padStart(4, "0")}.${ext}`;
          a.click();
          setProgress(Math.round((i + 1) / selectedFrames.length * 100));
          await new Promise(r => setTimeout(r, 80));
        }
      } else if (format === "gif") {
        const encoder = GIFEncoder();
        const delay = Math.round(1000 / fps);
        for (let i = 0; i < selectedFrames.length; i++) {
          const frame = selectedFrames[i]!;
          setProgressText(`Encoding frame ${i + 1}/${selectedFrames.length}…`);
          const layers = await db.layers.listByFrame(frame.id);
          renderFrameToCanvas(canvas, layers, bgColor);
          const ctx = canvas.getContext("2d")!;
          const imageData = ctx.getImageData(0, 0, W, H);
          const palette = quantize(imageData.data, 256, { format: "rgb444", oneBitAlpha: transparentBg });
          const index = applyPalette(imageData.data, palette);
          encoder.writeFrame(index, W, H, {
            palette,
            delay,
            repeat: loopGif ? 0 : -1,
            transparent: transparentBg,
          });
          setProgress(Math.round((i + 1) / selectedFrames.length * 85));
          await new Promise(r => setTimeout(r, 10));
        }
        setProgressText("Finalizing GIF…");
        encoder.finish();
        const buf = encoder.bytes();
        const blob = new Blob([buf], { type: "image/gif" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (project.name || "animation") + ".gif";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setProgress(100);
      } else {
        // WebM / MP4 via MediaRecorder
        setProgressText("Starting video encoder…");
        const supported =
          MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
          MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" :
          MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
        if (!supported) throw new Error("Video recording not supported in this browser. Try GIF or PNG sequence.");
        const chunks: Blob[] = [];
        const stream = canvas.captureStream(fps);
        const recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: quality === "ultra" ? 8000000 : quality === "high" ? 4000000 : 2000000 });
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        const finishPromise = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
        recorder.start();
        const frameDuration = 1000 / fps;
        for (let i = 0; i < selectedFrames.length; i++) {
          const frame = selectedFrames[i]!;
          setProgressText(`Rendering frame ${i + 1}/${selectedFrames.length}…`);
          const layers = await db.layers.listByFrame(frame.id);
          renderFrameToCanvas(canvas, layers, bgColor);
          setProgress(Math.round((i + 1) / selectedFrames.length * 85));
          await new Promise(r => setTimeout(r, frameDuration));
        }
        recorder.stop();
        await finishPromise;
        setProgressText("Downloading video…");
        const blob = new Blob(chunks, { type: supported });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (project.name || "animation") + ".webm";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setProgress(100);
      }
      setDone(true);
      setProgressText("Export complete!");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  }, [project, frames, format, quality, startFrame, endFrame, loopGif, transparentBg]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#07070f]">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"/>
    </div>
  );
  if (!project) return null;

  const outputW = Math.round(project.width * QUALITY_SCALE[quality]);
  const outputH = Math.round(project.height * QUALITY_SCALE[quality]);
  const selectedCount = endFrame - startFrame + 1;

  const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string; badge?: string }[] = [
    { id: "gif",          label: "Animated GIF",    icon: <Film className="w-4 h-4"/>,      desc: "Universal — works everywhere", badge: "Popular" },
    { id: "webm",         label: "WebM Video",      icon: <Video className="w-4 h-4"/>,      desc: "High quality, small file size" },
    { id: "mp4",          label: "MP4 Video",       icon: <Play className="w-4 h-4"/>,       desc: "Best compatibility on all devices" },
    { id: "png_sequence", label: "PNG Sequence",    icon: <ImageIcon className="w-4 h-4"/>,  desc: "Lossless — each frame as PNG" },
    { id: "jpg_sequence", label: "JPEG Sequence",   icon: <ImageIcon className="w-4 h-4"/>,  desc: "Smaller files — each frame as JPEG" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-white/[0.07] bg-[#0b0b18] flex items-center px-3 gap-2 shrink-0">
        <button className="w-8 h-8 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setLocation("/projects/" + projectId)}>
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Download className="w-3.5 h-3.5 text-white"/>
        </div>
        <div>
          <span className="font-bold text-sm text-white/90">Export</span>
          <span className="text-xs text-white/30 ml-2">{project.name}</span>
        </div>
        <span className="text-xs text-white/20 ml-2">{frames.length} frames · {project.width}×{project.height} · {project.fps}fps</span>
      </div>

      <div className="flex-1 flex items-start justify-center p-6 gap-6 flex-wrap">
        {/* Main settings */}
        <div className="w-full max-w-md space-y-4">
          {/* Format */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Format</p>
            <div className="space-y-1.5">
              {formats.map(f => (
                <button key={f.id}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                    format === f.id ? "border-violet-500/50 bg-violet-600/10" : "border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03]")}
                  onClick={() => { setFormat(f.id); setDone(false); }}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    format === f.id ? "bg-violet-600 text-white" : "bg-white/[0.05] text-white/40")}>
                    {f.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {f.label}
                      {f.badge && <span className="text-[9px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">{f.badge}</span>}
                    </p>
                    <p className="text-xs text-white/30">{f.desc}</p>
                  </div>
                  {format === f.id && <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center shrink-0"><div className="w-2 h-2 bg-white rounded-full"/></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Quality</p>
            <div className="flex gap-2">
              {(["low","medium","high","ultra"] as Quality[]).map(q => (
                <button key={q}
                  className={cn("flex-1 py-2 rounded-lg border text-xs font-semibold capitalize transition-all",
                    quality === q ? "border-violet-500/50 bg-violet-600/10 text-violet-300" : "border-white/[0.07] text-white/35 hover:border-white/15")}
                  onClick={() => { setQuality(q); setDone(false); }}>
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/20 mt-1.5">Output: {outputW}×{outputH}px</p>
          </div>

          {/* Frame range */}
          {frames.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                Frame Range <span className="text-white/20 normal-case font-normal">({selectedCount} frame{selectedCount !== 1 ? "s" : ""})</span>
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 w-10">Start</span>
                  <Slider value={[startFrame]} min={0} max={frames.length - 1} step={1}
                    onValueChange={([v]) => { setStartFrame(v!); if (v! > endFrame) setEndFrame(v!); }}
                    className="flex-1 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
                  <span className="text-[11px] text-white/30 w-6 text-right">{startFrame + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 w-10">End</span>
                  <Slider value={[endFrame]} min={0} max={frames.length - 1} step={1}
                    onValueChange={([v]) => { setEndFrame(v!); if (v! < startFrame) setStartFrame(v!); }}
                    className="flex-1 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
                  <span className="text-[11px] text-white/30 w-6 text-right">{endFrame + 1}</span>
                </div>
              </div>
            </div>
          )}

          {/* Advanced */}
          <div>
            <button className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
              onClick={() => setShowAdvanced(p => !p)}>
              <Settings2 className="w-3.5 h-3.5"/>
              Advanced options
              {showAdvanced ? <X className="w-3 h-3"/> : null}
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                {format === "gif" && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40">Loop GIF</span>
                    <button className={cn("w-9 h-5 rounded-full transition-all relative",
                      loopGif ? "bg-violet-600" : "bg-white/10")}
                      onClick={() => setLoopGif(p => !p)}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                        loopGif ? "left-4" : "left-0.5")}/>
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">Transparent background</span>
                  <button className={cn("w-9 h-5 rounded-full transition-all relative",
                    transparentBg ? "bg-violet-600" : "bg-white/10")}
                    onClick={() => setTransparentBg(p => !p)}>
                    <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                      transparentBg ? "left-4" : "left-0.5")}/>
                  </button>
                </div>
                {format === "gif" && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40">Dither (better quality)</span>
                    <button className={cn("w-9 h-5 rounded-full transition-all relative",
                      gifDither ? "bg-violet-600" : "bg-white/10")}
                      onClick={() => setGifDither(p => !p)}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                        gifDither ? "left-4" : "left-0.5")}/>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {exporting && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">{progressText}</span>
                <span className="text-sm font-bold text-violet-400">{progress}%</span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full transition-all duration-300"
                  style={{ width: progress + "%" }}/>
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
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-bold text-base rounded-xl shadow-lg shadow-violet-900/30">
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Exporting…</>
              : <><Download className="w-4 h-4 mr-2"/>Export {selectedCount} Frame{selectedCount !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>

        {/* Preview panel */}
        <div className="w-full max-w-xs">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Preview</p>
          <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.02] aspect-video flex items-center justify-center">
            {frames[startFrame]?.thumbnail
              ? <img src={frames[startFrame]!.thumbnail} alt="preview" className="w-full h-full object-contain"/>
              : <Film className="w-8 h-8 text-white/15"/>
            }
          </div>
          <div className="mt-2 space-y-1 text-xs text-white/30">
            <div className="flex justify-between"><span>Frames</span><span>{selectedCount}</span></div>
            <div className="flex justify-between"><span>Output size</span><span>{outputW}×{outputH}</span></div>
            <div className="flex justify-between"><span>Duration</span><span>{(selectedCount / project.fps).toFixed(2)}s @ {project.fps}fps</span></div>
            <div className="flex justify-between"><span>Format</span><span>{format.toUpperCase()}</span></div>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden"/>
      <Watermark/>
    </div>
  );
}
