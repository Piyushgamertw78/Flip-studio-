import { useState, useRef, useCallback, useEffect } from "react";
  import { useParams, useLocation } from "wouter";
  import { ArrowLeft, Download, Loader2, Film, ImageIcon, Video, Play, CheckCircle2, Settings2, Share2 } from "lucide-react";
  import { GIFEncoder, quantize, applyPalette } from "gifenc";
  import { Watermark } from "@/components/watermark";
  import { Button } from "@/components/ui/button";
  import { Slider } from "@/components/ui/slider";
  import { cn } from "@/lib/utils";
  import { db, type Project, type Frame, type Layer } from "@/lib/local-db";
  import { compositeAllLayers, safeParseCanvas } from "@/lib/rendering";

  type ExportFormat = "gif" | "webm" | "png_sequence" | "jpg_sequence" | "mp4";

  const isCapacitor = () =>
    typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.();

  async function saveFileToDevice(
    blobOrDataUrl: Blob | string,
    filename: string,
    mimeType: string
  ): Promise<void> {
    if (isCapacitor()) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        let base64: string;
        if (typeof blobOrDataUrl === "string") {
          base64 = blobOrDataUrl.includes(",") ? blobOrDataUrl.split(",")[1]! : blobOrDataUrl;
        } else {
          base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const r = reader.result as string;
              resolve(r.includes(",") ? r.split(",")[1]! : r);
            };
            reader.readAsDataURL(blobOrDataUrl);
          });
        }
        // Cache directory — works without any storage permission on all Android versions
        const result = await Filesystem.writeFile({
          path: `FlipStudio/${filename}`,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        // Open system share sheet so the user can save to Downloads, Google Drive, etc.
        try {
          const { Share } = await import("@capacitor/share");
          await Share.share({
            title: filename,
            url: result.uri,
            dialogTitle: "Save or share your export",
          });
        } catch {
          // Share cancelled or unavailable — file is still in cache
        }
        return;
      } catch (fsErr) {
        console.warn("Filesystem save failed, trying Web Share:", fsErr);
        if (typeof blobOrDataUrl !== "string") {
          try {
            const file = new File([blobOrDataUrl], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
            return;
          } catch {}
        }
      }
    }
    // Web: anchor download
    const url =
      typeof blobOrDataUrl === "string"
        ? blobOrDataUrl
        : URL.createObjectURL(blobOrDataUrl);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof blobOrDataUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

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
        const [proj, fs] = await Promise.all([
          db.projects.get(projectId),
          db.frames.listByProject(projectId),
        ]);
        setProject(proj ?? null);
        setFrames(fs);
        setEndFrame(fs.length - 1);
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
      const selected = frames.slice(startFrame, endFrame + 1);

      try {
        if (format === "png_sequence" || format === "jpg_sequence") {
          for (let i = 0; i < selected.length; i++) {
            setProgressText(`Exporting frame ${i + 1}/${selected.length}…`);
            const layers = await db.layers.listByFrame(selected[i]!.id);
            renderFrameToCanvas(canvas, layers, bgColor);
            const ext  = format === "jpg_sequence" ? "jpg" : "png";
            const mime = format === "jpg_sequence" ? "image/jpeg" : "image/png";
            const qual = format === "jpg_sequence" ? 0.92 : undefined;
            const fname = `${project.name}_frame_${String(i + startFrame + 1).padStart(4, "0")}.${ext}`;
            await saveFileToDevice(canvas.toDataURL(mime, qual), fname, mime);
            setProgress(Math.round((i + 1) / selected.length * 100));
            await new Promise(r => setTimeout(r, 80));
          }
        } else if (format === "gif") {
          const encoder = GIFEncoder();
          const delay = Math.round(1000 / fps);
          for (let i = 0; i < selected.length; i++) {
            setProgressText(`Encoding frame ${i + 1}/${selected.length}…`);
            const layers = await db.layers.listByFrame(selected[i]!.id);
            renderFrameToCanvas(canvas, layers, bgColor);
            const ctx = canvas.getContext("2d")!;
            const imageData = ctx.getImageData(0, 0, W, H);
            const palette = quantize(imageData.data, 256, { format: "rgb444", oneBitAlpha: transparentBg });
            const index = applyPalette(imageData.data, palette);
            encoder.writeFrame(index, W, H, { palette, delay, repeat: loopGif ? 0 : -1, transparent: transparentBg });
            setProgress(Math.round((i + 1) / selected.length * 85));
            await new Promise(r => setTimeout(r, 10));
          }
          setProgressText("Finalizing GIF…");
          encoder.finish();
          const blob = new Blob([encoder.bytes()], { type: "image/gif" });
          await saveFileToDevice(blob, (project.name || "animation") + ".gif", "image/gif");
          setProgress(100);
        } else {
          setProgressText("Starting video encoder…");
          const supported =
            MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
            MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" :
            MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
          if (!supported) throw new Error("Video recording not supported in this browser. Try GIF or PNG sequence.");
          const chunks: Blob[] = [];
          const stream = canvas.captureStream(fps);
          const recorder = new MediaRecorder(stream, {
            mimeType: supported,
            videoBitsPerSecond: quality === "ultra" ? 8_000_000 : quality === "high" ? 4_000_000 : 2_000_000,
          });
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          const done$ = new Promise<void>(r => { recorder.onstop = () => r(); });
          recorder.start();
          const frameDuration = 1000 / fps;
          for (let i = 0; i < selected.length; i++) {
            setProgressText(`Rendering frame ${i + 1}/${selected.length}…`);
            const layers = await db.layers.listByFrame(selected[i]!.id);
            renderFrameToCanvas(canvas, layers, bgColor);
            setProgress(Math.round((i + 1) / selected.length * 85));
            await new Promise(r => setTimeout(r, frameDuration));
          }
          recorder.stop();
          await done$;
          setProgressText("Saving video…");
          const blob = new Blob(chunks, { type: supported });
          const ext  = format === "mp4" ? "mp4" : "webm";
          await saveFileToDevice(blob, (project.name || "animation") + "." + ext, supported);
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
    const native = isCapacitor();

    const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string; badge?: string }[] = [
      { id: "gif",          label: "Animated GIF",  icon: <Film className="w-4 h-4"/>,     desc: "Universal — works everywhere", badge: "Popular" },
      { id: "webm",         label: "WebM Video",    icon: <Video className="w-4 h-4"/>,     desc: "High quality, small file size" },
      { id: "mp4",          label: "MP4 Video",     icon: <Play className="w-4 h-4"/>,      desc: "Best compatibility on all devices" },
      { id: "png_sequence", label: "PNG Sequence",  icon: <ImageIcon className="w-4 h-4"/>, desc: "Lossless — each frame as PNG" },
      { id: "jpg_sequence", label: "JPEG Sequence", icon: <ImageIcon className="w-4 h-4"/>, desc: "Smaller files — each frame as JPEG" },
    ];

    return (
      <div className="min-h-screen bg-[#07070f] text-white flex flex-col page-enter-left">
        <div className="h-12 border-b border-white/[0.07] bg-[#0b0b18] flex items-center px-3 gap-2 shrink-0">
          <button className="w-8 h-8 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setLocation("/projects/" + projectId)}>
            <ArrowLeft className="w-4 h-4"/>
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Download className="w-3.5 h-3.5 text-white"/>
          </div>
          <span className="font-bold text-sm text-white/90">Export</span>
          <span className="text-xs text-white/30 ml-1">{project.name}</span>
          <span className="text-xs text-white/20 ml-2">{frames.length} frames · {project.width}×{project.height} · {project.fps}fps</span>
        </div>

        <div className="flex-1 flex items-start justify-center p-6">
          <div className="w-full max-w-md space-y-4">
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

            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Quality</p>
              <div className="flex gap-2">
                {(["low","medium","high","ultra"] as Quality[]).map(q => (
                  <button key={q} onClick={() => { setQuality(q); setDone(false); }}
                    className={cn("flex-1 py-2.5 text-xs font-semibold rounded-xl border capitalize transition-all",
                      quality === q ? "border-violet-500/50 bg-violet-600/15 text-white" : "border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/20")}>
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/25 mt-1.5">Output: {outputW}×{outputH}px</p>
            </div>

            {frames.length > 1 && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Frame Range ({selectedCount} frame{selectedCount !== 1 ? "s" : ""})
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-white/30 mb-1.5"><span>Start</span><span>{startFrame + 1}</span></div>
                    <Slider min={0} max={frames.length - 1} step={1} value={[startFrame]}
                      onValueChange={([v]) => { setStartFrame(v!); if (v! > endFrame) setEndFrame(v!); setDone(false); }} className="w-full"/>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-white/30 mb-1.5"><span>End</span><span>{endFrame + 1}</span></div>
                    <Slider min={0} max={frames.length - 1} step={1} value={[endFrame]}
                      onValueChange={([v]) => { setEndFrame(v!); if (v! < startFrame) setStartFrame(v!); setDone(false); }} className="w-full"/>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setShowAdvanced(p => !p)}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors">
              <Settings2 className="w-3.5 h-3.5"/> Advanced options
            </button>
            {showAdvanced && (
              <div className="glass rounded-2xl p-4 space-y-3">
                {format === "gif" && (
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-white/70">Loop GIF</span>
                    <div onClick={() => setLoopGif(p => !p)} className={cn("w-10 h-5 rounded-full transition-all", loopGif ? "bg-violet-600" : "bg-white/15")}>
                      <div className={cn("w-4 h-4 bg-white rounded-full shadow m-0.5 transition-all", loopGif && "translate-x-5")}/>
                    </div>
                  </label>
                )}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-white/70">Transparent background</span>
                  <div onClick={() => setTransparentBg(p => !p)} className={cn("w-10 h-5 rounded-full transition-all", transparentBg ? "bg-violet-600" : "bg-white/15")}>
                    <div className={cn("w-4 h-4 bg-white rounded-full shadow m-0.5 transition-all", transparentBg && "translate-x-5")}/>
                  </div>
                </label>
              </div>
            )}

            {(exporting || done) && (
              <div className={cn("rounded-xl px-4 py-3 space-y-2",
                done ? "bg-green-500/10 border border-green-500/25" : "bg-white/[0.04] border border-white/[0.07]")}>
                {!done ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">{progressText}</span>
                      <span className="text-xs text-white/50">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300" style={{ width: progress + "%" }}/>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-sm text-green-300 font-semibold">Export complete!</p>
                      <p className="text-xs text-green-300/60 mt-0.5">
                        {native ? 'A share sheet opened — tap "Save to Files" or "Downloads" to store it on your device.' : "Check your downloads folder."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button onClick={exportAnimation} disabled={exporting}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 font-bold text-base rounded-xl shadow-lg shadow-violet-900/30">
              {exporting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Exporting…</>
                : <>{native ? <Share2 className="w-4 h-4 mr-2"/> : <Download className="w-4 h-4 mr-2"/>}Export {selectedCount} Frame{selectedCount !== 1 ? "s" : ""}</>}
            </Button>

            <canvas ref={canvasRef} className="hidden"/>
          </div>
        </div>
        <Watermark />
      </div>
    );
  }
  