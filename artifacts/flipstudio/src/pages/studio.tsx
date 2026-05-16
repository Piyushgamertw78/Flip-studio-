import { useState, useRef, useEffect, useCallback, type TouchEvent as ReactTouchEvent } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Plus, Trash2,
  Eye, EyeOff, Lock, Unlock, Copy, Layers, ChevronUp, ChevronDown,
  ZoomIn, ZoomOut, Undo2, Redo2, Download, Grid3X3,
  Pencil, PenLine, Paintbrush, Eraser, PaintBucket, Move,
  Minus, Square, Circle, Triangle, Type, Pipette,
  FlipHorizontal2, X, Repeat, Star, Hexagon,
  AlignLeft, Repeat2, Settings2, SlidersHorizontal,
  Scissors, Clipboard,
  Maximize2, Target, ChevronRight, ChevronLeft, Film, Edit3,
  MoreHorizontal, Crosshair, Sliders, ArrowRight,
  Mic, MicOff, ImagePlus, Music2, StopCircle, Volume2, VolumeX, Loader2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorWheel } from "@/components/color-wheel";
import { Watermark } from "@/components/watermark";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { db, type Project, type Frame, type Layer } from "@/lib/local-db";
import {
  type Tool, type Point, type Stroke,
  safeParseCanvas, renderSingleStroke, compositeAllLayers,
} from "@/lib/rendering";

const BLEND_MODES: string[] = [
  "source-over","multiply","screen","overlay","darken","lighten",
  "color-dodge","color-burn","hard-light","soft-light","difference",
  "exclusion","hue","saturation","color","luminosity",
];

const ALL_TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut: string; group: string }[] = [
  { id: "pencil",      icon: <Pencil className="w-4 h-4" />,      label: "Pencil",       shortcut: "P", group: "draw" },
  { id: "pen",         icon: <PenLine className="w-4 h-4" />,     label: "Ink Pen",      shortcut: "N", group: "draw" },
  { id: "brush",       icon: <Paintbrush className="w-4 h-4" />,  label: "Brush",        shortcut: "B", group: "draw" },
  { id: "chalk",       icon: <Edit3 className="w-4 h-4" />,       label: "Chalk",        shortcut: "H", group: "draw" },
  { id: "marker",      icon: <PenLine className="w-4 h-4" />,     label: "Marker",       shortcut: "M", group: "draw" },
  { id: "watercolor",  icon: <Sliders className="w-4 h-4" />,     label: "Watercolor",   shortcut: "W", group: "draw" },
  { id: "spray",       icon: <Crosshair className="w-4 h-4" />,   label: "Spray",        shortcut: "Y", group: "draw" },
  { id: "calligraphy", icon: <AlignLeft className="w-4 h-4" />,   label: "Calligraphy",  shortcut: "G", group: "draw" },
  { id: "eraser",      icon: <Eraser className="w-4 h-4" />,      label: "Eraser",       shortcut: "E", group: "draw" },
  { id: "fill",        icon: <PaintBucket className="w-4 h-4" />, label: "Fill",         shortcut: "F", group: "draw" },
  { id: "gradient",    icon: <Sliders className="w-4 h-4" />,     label: "Gradient",     shortcut: "J", group: "draw" },
  { id: "eyedropper",  icon: <Pipette className="w-4 h-4" />,     label: "Eyedropper",   shortcut: "I", group: "draw" },
  { id: "move",        icon: <Move className="w-4 h-4" />,        label: "Pan",          shortcut: "V", group: "nav" },
  { id: "select",      icon: <Crosshair className="w-4 h-4" />,   label: "Select",       shortcut: "S", group: "nav" },
  { id: "line",        icon: <Minus className="w-4 h-4" />,       label: "Line",         shortcut: "L", group: "shape" },
  { id: "rect",        icon: <Square className="w-4 h-4" />,      label: "Rectangle",    shortcut: "R", group: "shape" },
  { id: "ellipse",     icon: <Circle className="w-4 h-4" />,      label: "Ellipse",      shortcut: "O", group: "shape" },
  { id: "triangle",    icon: <Triangle className="w-4 h-4" />,    label: "Triangle",     shortcut: "T", group: "shape" },
  { id: "arrow",       icon: <ArrowRight className="w-4 h-4" />,  label: "Arrow",        shortcut: "A", group: "shape" },
  { id: "star",        icon: <Star className="w-4 h-4" />,        label: "Star",         shortcut: "K", group: "shape" },
  { id: "polygon",     icon: <Hexagon className="w-4 h-4" />,     label: "Polygon",      shortcut: "Q", group: "shape" },
  { id: "text",        icon: <Type className="w-4 h-4" />,        label: "Text",         shortcut: "X", group: "shape" },
];

const COLOR_PALETTES: Record<string, string[]> = {
  Classic: ["#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f59e0b"],
  Pastel:  ["#fce7f3","#fee2e2","#fef3c7","#d1fae5","#dbeafe","#ede9fe","#ccfbf1","#f0fdf4","#fdf4ff","#fff7ed","#f0f9ff","#fef9c3"],
  Neon:    ["#ff006e","#fb5607","#ffbe0b","#3a86ff","#8338ec","#06d6a0","#ff4d6d","#4cc9f0","#7209b7","#f72585","#4361ee","#4895ef"],
  Earth:   ["#8b4513","#a0522d","#cd853f","#deb887","#f5deb3","#fffacd","#556b2f","#6b8e23","#2f4f4f","#708090","#a9a9a9","#696969"],
  Skin:    ["#fde68a","#fcd34d","#fbbf24","#f59e0b","#fdba74","#fb923c","#f97316","#ea580c","#c2410c","#92400e","#78350f","#451a03"],
  Grays:   ["#ffffff","#f3f4f6","#e5e7eb","#d1d5db","#9ca3af","#6b7280","#4b5563","#374151","#1f2937","#111827","#030712","#000000"],
};

const SYMMETRY_OPTIONS = ["none","horizontal","vertical","both","radial4","radial8"] as const;
type SymmetryMode = typeof SYMMETRY_OPTIONS[number];

function FlipVIcon() {
  return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8H3"/><path d="m15 3-5 5-5-5"/><path d="m15 21-5-5-5 5"/></svg>;
}

function getSymmetryPoints(pt: Point, mode: SymmetryMode): Point[] {
  if (mode === "none") return [pt];
  const p = { ...pt };
  if (mode === "horizontal") return [p, { ...p, y: 1 - p.y }];
  if (mode === "vertical") return [p, { ...p, x: 1 - p.x }];
  if (mode === "both") return [p, { ...p, x: 1-p.x }, { ...p, y: 1-p.y }, { x:1-p.x, y:1-p.y, pressure:p.pressure }];
  if (mode === "radial4") {
    return [
      p,
      { x: p.y, y: 1-p.x, pressure: p.pressure },
      { x: 1-p.x, y: 1-p.y, pressure: p.pressure },
      { x: 1-p.y, y: p.x, pressure: p.pressure },
    ];
  }
  if (mode === "radial8") {
    return [
      p,
      { x: p.y, y: p.x, pressure: p.pressure },
      { x: 1-p.x, y: p.y, pressure: p.pressure },
      { x: 1-p.y, y: 1-p.x, pressure: p.pressure },
      { x: 1-p.x, y: 1-p.y, pressure: p.pressure },
      { x: 1-p.y, y: p.x, pressure: p.pressure },
      { x: p.x, y: 1-p.y, pressure: p.pressure },
      { x: p.y, y: 1-p.y, pressure: p.pressure },
    ];
  }
  return [pt];
}

export default function Studio() {
  const { id } = useParams<{ id: string }>();
    const projectId = Number(id);
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Android hardware back button — go to dashboard instead of exiting the app
    // (auto-save fires every 1.2s so work is preserved)
    useEffect(() => {
      const onBack = (e: Event) => {
        e.preventDefault();
        setLocation("/");
      };
      document.addEventListener("backbutton", onBack);
      return () => document.removeEventListener("backbutton", onBack);
    }, [setLocation]);

  const [project, setProject]   = useState<Project | null>(null);
  const [frames, setFrames]     = useState<Frame[]>([]);
  const [layers, setLayers]     = useState<Layer[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [currentLayerId, setCurrentLayerId]   = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);

  const layerStrokes = useRef<Map<number, Stroke[]>>(new Map());
  const undoStack    = useRef<Map<number, Stroke[]>[]>([]);
  const redoStack    = useRef<Map<number, Stroke[]>[]>([]);

  // Tool state
  const [tool, setTool]             = useState<Tool>("pencil");
  const [color, setColor]           = useState("#ffffff");
  const [color2, setColor2]         = useState("#000000"); // secondary/gradient end color
  const [size, setSize]             = useState(6);
  const [opacity, setOpacity]       = useState(100);
  const [hardness, setHardness]     = useState(80);
  const [flow, setFlow]             = useState(100);
  const [brushStabilizer, setBrushStabilizer] = useState(3);
  const [filledShape, setFilledShape] = useState(false);
  const [polygonSides, setPolygonSides] = useState(6);
  const [gradientType, setGradientType] = useState<"linear"|"radial">("linear");
  const [speedPressure, setSpeedPressure] = useState(false); // brush size varies with speed
  const [bgPattern, setBgPattern] = useState<"none"|"checkerboard"|"dots"|"lines">("none"); // canvas bg pattern overlay
  const [zoom, setZoom]             = useState(1);
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 });
  const [recentColors, setRecentColors] = useState<string[]>(["#000000","#ffffff","#ef4444","#3b82f6","#22c55e"]);
  const [activePalette, setActivePalette] = useState<string>("Classic");

  // UI panels
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showColorPanel, setShowColorPanel]   = useState(true);
  const [showBrushPanel, setShowBrushPanel]   = useState(false);
  const [showTimelineTools, setShowTimelineTools] = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [showShortcuts, setShowShortcuts]     = useState(false);
  const [showRenameLayer, setShowRenameLayer] = useState<number | null>(null);
  const [renameValue, setRenameValue]         = useState("");
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [projectNameVal, setProjectNameVal]   = useState("");
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [resizeW, setResizeW] = useState(800);
  const [resizeH, setResizeH] = useState(600);
  const [isExportingWebm, setIsExportingWebm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  // Animation
  const [isPlaying, setIsPlaying]       = useState(false);
  const [loopPlay, setLoopPlay]         = useState(true);
  const [pingPong, setPingPong]         = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 0.25 × · 0.5 × · 1× · 2× · 4×
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [onionPrev, setOnionPrev]   = useState(2);
  const [onionNext, setOnionNext]   = useState(1);
  const [onionPrevColor, setOnionPrevColor] = useState("#ff4444");
  const [onionNextColor, setOnionNextColor] = useState("#44aaff");
  const [editingFrameLabel, setEditingFrameLabel] = useState<number | null>(null);
  const [frameLabelVal, setFrameLabelVal] = useState("");
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid]     = useState(false);
  const [gridSize, setGridSize]     = useState(40);
  const [showRulers, setShowRulers] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>("none");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [textInput, setTextInput]   = useState<{ x: number; y: number; val: string } | null>(null);
  const [textFont, setTextFont]     = useState("Inter, sans-serif");
  const [textBold, setTextBold]     = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingFrameDelay, setEditingFrameDelay] = useState<number | null>(null); // frame idx

  // ── Canvas display width (JS-based, avoids CSS min() issues on older Android WebViews) ──
  const [canvasDisplayW, setCanvasDisplayW] = useState<number>(300);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // ── Reference image ──────────────────────────────────────────────────────────
  const [refImage, setRefImage]         = useState<string | null>(null);
  const [refOpacity, setRefOpacity]     = useState(50);
  const [showRefImage, setShowRefImage] = useState(true);
  const [showRefPanel, setShowRefPanel] = useState(false);
  // ── Audio track ──────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording]   = useState(false);
  const [audioURL, setAudioURL]         = useState<string | null>(null);
  const [showAudioBar, setShowAudioBar] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const curStroke  = useRef<Stroke | null>(null);
  const allCurStrokes = useRef<Stroke[]>([]); // for symmetry - multiple strokes at once
  const playTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panStart   = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pingPongDir = useRef(1);

  // Touch gestures
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const touchPanStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastDrawTime = useRef<number>(0);
  const lastDrawPos  = useRef<{ x: number; y: number } | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const refInputRef       = useRef<HTMLInputElement>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const audioElemRef      = useRef<HTMLAudioElement | null>(null);

  const CW = project?.width ?? 1920;
  const CH = project?.height ?? 1080;

  // ─── Load project ───────────────────────────────────────────────────────────
  useEffect(() => {
    let unmounted = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      // Safety: if IndexedDB hangs (blocked connection, first install, etc.), navigate back after 10s
      safetyTimer = setTimeout(() => {
        if (!unmounted) { setLoading(false); setLocation("/"); }
      }, 10000);

      try {
        const [proj, fs] = await Promise.all([
          db.projects.get(projectId),
          db.frames.listByProject(projectId),
        ]);

        if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
        if (unmounted) return; // user navigated away — don't update state

        if (!proj) { setLoading(false); setLocation("/"); return; }
        setProject(proj);
        setFrames(fs);
        setProjectNameVal(proj.name);
        if (proj.audioTrack) setAudioURL(proj.audioTrack);

        if (fs.length > 0) {
          // Fetch layers — gracefully degrade if this fails
          const ls = await db.layers.listByFrame(fs[0]!.id).catch((): Layer[] => []);
          if (unmounted) return;
          setLayers(ls);
          const map = new Map<number, Stroke[]>();
          for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
          layerStrokes.current = map;
          setCurrentLayerId(ls[0]?.id ?? null);
        }
        if (!unmounted) setLoading(false);
      } catch {
        if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
        if (!unmounted) { setLoading(false); setLocation("/"); }
      }
    };

    void load();

    // Cleanup: mark unmounted, cancel safety timer so it can't fire setLocation on another page
    return () => {
      unmounted = true;
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    };
  }, [projectId]);

  // ─── Canvas display size (JS-calculated — CSS min() not supported on older Android WebViews) ───
  useEffect(() => {
    const compute = () => {
      const panelW = showLayersPanel ? 272 : 52;
      const availW = window.innerWidth - panelW - 8;
      const availH = window.innerHeight - 215;
      const ratio = CW / CH;
      const fromH = availH * ratio;
      setCanvasDisplayW(Math.max(80, Math.min(availW, fromH)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [showLayersPanel, CW, CH]);

  // ─── Unmount cleanup — releases canvas GPU memory, prevents Android OOM crash ─
  useEffect(() => {
    return () => {
      // Clear any pending auto-save
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      // Shrink canvases to 1×1 to release backing store memory immediately
      // This prevents the "out of memory" crash when pressing back on Android
      try { const c = canvasRef.current; if (c) { c.width = 1; c.height = 1; } } catch {}
      try { const o = overlayRef.current; if (o) { o.width = 1; o.height = 1; } } catch {}
    };
  }, []);

  const currentFrame   = frames[currentFrameIdx];
  const currentLayer   = layers.find(l => l.id === currentLayerId);
  const sortedLayers   = [...layers].sort((a, b) => b.order - a.order); // top-first for display

  // ─── Redraw ─────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Transparency grid for transparent bg
    if (project.backgroundColor === "transparent" || project.backgroundColor === "") {
      const gridCtx = ctx;
      gridCtx.save();
      for (let gy = 0; gy < h; gy += 16) {
        for (let gx = 0; gx < w; gx += 16) {
          gridCtx.fillStyle = ((gx + gy) / 16) % 2 === 0 ? "#cccccc" : "#ffffff";
          gridCtx.fillRect(gx, gy, 16, 16);
        }
      }
      gridCtx.restore();
    }

    // Onion skinning — previous frames (customisable colour)
    if (showOnionSkin) {
      const hexToRgb = (hex: string) => {
        const h = hex.replace("#","");
        return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
      };
      for (let i = 1; i <= onionPrev; i++) {
        const pf = frames[currentFrameIdx - i];
        if (!pf) continue;
        const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
        const tmpCtx = tmp.getContext("2d")!;
        tmpCtx.fillStyle = project.backgroundColor;
        tmpCtx.fillRect(0, 0, w, h);
        void db.layers.listByFrame(pf.id).then(ls => {
          const map = new Map<number, Stroke[]>();
          for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
          compositeAllLayers(tmpCtx, ls, map, w, h, "transparent");
        });
        ctx.globalAlpha = 0.25 / i;
        ctx.globalCompositeOperation = "source-over";
        const pc = hexToRgb(onionPrevColor);
        ctx.fillStyle = `rgba(${pc.r},${pc.g},${pc.b},${0.15 / i})`;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0);
        ctx.globalAlpha = 1;
      }

      // Forward frames
      for (let i = 1; i <= onionNext; i++) {
        const nf = frames[currentFrameIdx + i];
        if (!nf) continue;
        ctx.globalAlpha = 0.18 / i;
        const nc = hexToRgb(onionNextColor);
        ctx.fillStyle = `rgba(${nc.r},${nc.g},${nc.b},${0.12 / i})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    }

    // Composite all layers
    compositeAllLayers(ctx, layers, layerStrokes.current, w, h, "transparent");

    // Grid overlay
    if (showGrid) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#888888";
      ctx.lineWidth = 0.5;
      for (let x = gridSize; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = gridSize; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // Center guides
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = "#60a5fa";
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Symmetry guide
    if (symmetryMode !== "none") {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      if (symmetryMode === "horizontal" || symmetryMode === "both" || symmetryMode === "radial4" || symmetryMode === "radial8") {
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      }
      if (symmetryMode === "vertical" || symmetryMode === "both" || symmetryMode === "radial4" || symmetryMode === "radial8") {
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      }
      if (symmetryMode === "radial4" || symmetryMode === "radial8") {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Rulers
    if (showRulers) {
      ctx.save();
      ctx.fillStyle = "rgba(20,20,40,0.85)";
      ctx.fillRect(0, 0, w, 20);
      ctx.fillRect(0, 0, 20, h);
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 0.5;
      ctx.fillStyle = "#aaa";
      ctx.font = "10px monospace";
      const step = Math.max(20, Math.round(50 / zoom));
      for (let x = 0; x < w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, 20); ctx.stroke();
        if (x > 0) ctx.fillText(String(x), x + 2, 13);
      }
      for (let y = 0; y < h; y += step) {
        ctx.save(); ctx.translate(10, y); ctx.rotate(-Math.PI / 2);
        if (y > 0) ctx.fillText(String(y), -14, 5);
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(20, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Selection rect
    if (selectionRect) {
      const { x, y, w: sw, h: sh } = selectionRect;
      ctx.save();
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x * w, y * h, sw * w, sh * h);
      ctx.fillStyle = "rgba(96,165,250,0.08)";
      ctx.fillRect(x * w, y * h, sw * w, sh * h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }, [project, layers, frames, currentFrameIdx, showOnionSkin, onionPrev, onionNext, onionPrevColor, onionNextColor, showGrid, gridSize, symmetryMode, showRulers, selectionRect, zoom]);

  useEffect(() => { redraw(); }, [redraw]);

  // ─── Playback ───────────────────────────────────────────────────────────────
  const advancePlayback = useCallback(() => {
    setCurrentFrameIdx(prev => {
      let next = prev + pingPongDir.current;
      if (pingPong) {
        if (next >= frames.length) { pingPongDir.current = -1; next = frames.length - 2; }
        if (next < 0) { pingPongDir.current = 1; next = 1; }
      } else {
        if (next >= frames.length) {
          if (loopPlay) next = 0;
          else { setIsPlaying(false); return prev; }
        }
      }
      const frame = frames[next];
      if (frame) {
        void db.layers.listByFrame(frame.id).then(ls => {
          const map = new Map<number, Stroke[]>();
          for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
          layerStrokes.current = map;
          setLayers(ls);
        });
        // Schedule next advance using this frame's duration if set
        const frameDuration = (frame.duration && frame.duration > 0)
          ? frame.duration
          : Math.round(1000 / ((project?.fps ?? 12) * playbackSpeed));
        if (playTimer.current) clearTimeout(playTimer.current as unknown as ReturnType<typeof setTimeout>);
        (playTimer.current as unknown) = setTimeout(advancePlayback, frameDuration / playbackSpeed);
      }
      return next;
    });
  }, [frames, pingPong, loopPlay, project, playbackSpeed]);

  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      const baseDelay = Math.round(1000 / ((project?.fps ?? 12) * playbackSpeed));
      (playTimer.current as unknown) = setTimeout(advancePlayback, baseDelay);
    } else {
      if (playTimer.current) { clearTimeout(playTimer.current as unknown as ReturnType<typeof setTimeout>); playTimer.current = null; }
    }
    return () => { if (playTimer.current) clearInterval(playTimer.current); };
  }, [isPlaying, frames, project?.fps, loopPlay, pingPong, playbackSpeed]);

  // ─── Save ───────────────────────────────────────────────────────────────────
  const saveCurrentLayerData = useCallback(async () => {
    if (!currentFrame) return;
    for (const layer of layers) {
      const strokes = layerStrokes.current.get(layer.id) ?? [];
      await db.layers.update(layer.id, { canvasData: JSON.stringify({ strokes }) });
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const thumb = canvas.toDataURL("image/jpeg", 0.35);
      await db.frames.update(currentFrame.id, { thumbnail: thumb });
      await db.projects.update(projectId, { thumbnail: thumb });
      setFrames(prev => prev.map((f, i) => i === currentFrameIdx ? { ...f, thumbnail: thumb } : f));
    }
  }, [currentFrame, layers, projectId, currentFrameIdx]);

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveCurrentLayerData().then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1800);
      });
    }, 1200);
  }, [saveCurrentLayerData]);

  // ─── Frame switching ─────────────────────────────────────────────────────────
  const switchFrame = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= frames.length || idx === currentFrameIdx) return;
    await saveCurrentLayerData();
    const frame = frames[idx];
    if (!frame) return;
    const ls = await db.layers.listByFrame(frame.id);
    const map = new Map<number, Stroke[]>();
    for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
    layerStrokes.current = map;
    setLayers(ls);
    setCurrentLayerId(ls[0]?.id ?? null);
    undoStack.current = []; redoStack.current = [];
    setCurrentFrameIdx(idx);
  }, [currentFrameIdx, frames, saveCurrentLayerData]);

  // ─── Frame management ────────────────────────────────────────────────────────
  const addFrame = useCallback(async () => {
    if (!currentFrame) return;
    await saveCurrentLayerData();
    const now = new Date().toISOString();
    const newOrder = (currentFrame.order ?? currentFrameIdx) + 1;
    // Shift existing frames
    for (const f of frames.slice(currentFrameIdx + 1)) {
      await db.frames.update(f.id, { order: f.order + 1 });
    }
    const newFrameId = await db.frames.create({
      projectId, order: newOrder, duration: 0,
      canvasData: JSON.stringify({ strokes: [] }), thumbnail: "", createdAt: now,
    });
    // Clone layers structure from current frame
    const layerDefs = [...layers].sort((a, b) => a.order - b.order);
    const newLayers: Layer[] = [];
    for (const l of layerDefs) {
      const newId = await db.layers.create({
        frameId: newFrameId, projectId, name: l.name, order: l.order,
        visible: true, locked: false, opacity: 100, blendMode: "source-over",
        canvasData: JSON.stringify({ strokes: [] }), createdAt: now,
      });
      newLayers.push({ ...l, id: newId, frameId: newFrameId, canvasData: JSON.stringify({ strokes: [] }) });
    }
    const allFrames = await db.frames.listByProject(projectId);
    setFrames(allFrames);
    const newIdx = currentFrameIdx + 1;
    layerStrokes.current = new Map(newLayers.map(l => [l.id, []]));
    setLayers(newLayers);
    setCurrentLayerId(newLayers[0]?.id ?? null);
    undoStack.current = []; redoStack.current = [];
    setCurrentFrameIdx(newIdx);
  }, [currentFrame, currentFrameIdx, frames, layers, projectId, saveCurrentLayerData]);

  const duplicateFrame = useCallback(async (idx: number) => {
    const frame = frames[idx];
    if (!frame) return;
    await saveCurrentLayerData();
    await db.frames.duplicate(frame.id);
    const allFrames = await db.frames.listByProject(projectId);
    setFrames(allFrames);
    await switchFrame(idx + 1);
  }, [frames, projectId, saveCurrentLayerData, switchFrame]);

  const deleteFrame = useCallback(async (idx: number) => {
    if (frames.length <= 1) return;
    const frame = frames[idx];
    if (!frame) return;
    const ls = await db.layers.listByFrame(frame.id);
    for (const l of ls) await db.layers.delete(l.id);
    await db.frames.delete(frame.id);
    const allFrames = await db.frames.listByProject(projectId);
    setFrames(allFrames);
    const newIdx = Math.max(0, idx - 1);
    if (allFrames[newIdx]) {
      const ls2 = await db.layers.listByFrame(allFrames[newIdx]!.id);
      const map = new Map<number, Stroke[]>();
      for (const l of ls2) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
      layerStrokes.current = map;
      setLayers(ls2);
      setCurrentLayerId(ls2[0]?.id ?? null);
    }
    setCurrentFrameIdx(newIdx);
  }, [frames, projectId]);

  const addMultipleFrames = useCallback(async (count: number) => {
    for (let i = 0; i < count; i++) await addFrame();
  }, [addFrame]);

  // Copy current frame artwork forward to next frame
  const copyArtworkToNextFrame = useCallback(async () => {
    if (currentFrameIdx >= frames.length - 1) { toast({ title: "No next frame — add one first" }); return; }
    await saveCurrentLayerData();
    const nextFrame = frames[currentFrameIdx + 1];
    if (!nextFrame) return;
    const nextLayers = await db.layers.listByFrame(nextFrame.id);
    let copied = 0;
    for (const nextLayer of nextLayers) {
      const match = layers.find(l => l.name === nextLayer.name && l.order === nextLayer.order);
      if (match) {
        const strokes = layerStrokes.current.get(match.id) ?? [];
        await db.layers.update(nextLayer.id, { canvasData: JSON.stringify({ strokes }) });
        copied++;
      }
    }
    toast({ title: copied > 0 ? `Artwork copied to frame ${currentFrameIdx + 2}` : "No matching layers found" });
  }, [currentFrameIdx, frames, layers, saveCurrentLayerData, toast]);

  // ─── Layer management ────────────────────────────────────────────────────────
  const addLayer = useCallback(async () => {
    if (!currentFrame) return;
    const maxOrder = Math.max(0, ...layers.map(l => l.order));
    const now = new Date().toISOString();
    const newId = await db.layers.create({
      frameId: currentFrame.id, projectId, name: `Layer ${layers.length + 1}`,
      order: maxOrder + 1, visible: true, locked: false, opacity: 100,
      blendMode: "source-over", canvasData: JSON.stringify({ strokes: [] }), createdAt: now,
    });
    const ls = await db.layers.listByFrame(currentFrame.id);
    layerStrokes.current.set(newId, []);
    setLayers(ls);
    setCurrentLayerId(newId);
  }, [currentFrame, layers, projectId]);

  const deleteLayer = useCallback(async (layerId: number) => {
    if (layers.length <= 1) return;
    await db.layers.delete(layerId);
    layerStrokes.current.delete(layerId);
    if (!currentFrame) return;
    const ls = await db.layers.listByFrame(currentFrame.id);
    setLayers(ls);
    setCurrentLayerId(ls[0]?.id ?? null);
  }, [layers, currentFrame]);

  const duplicateLayer = useCallback(async (layerId: number) => {
    const newId = await db.layers.duplicate(layerId);
    if (newId && currentLayerId === layerId) {
      const strokes = layerStrokes.current.get(layerId) ?? [];
      layerStrokes.current.set(newId, [...strokes.map(s => ({ ...s, points: [...s.points] }))]);
    }
    if (!currentFrame) return;
    const ls = await db.layers.listByFrame(currentFrame.id);
    setLayers(ls);
  }, [currentFrame, currentLayerId]);

  const toggleVis = useCallback(async (layerId: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    await db.layers.update(layerId, { visible: !layer.visible });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  }, [layers]);

  const toggleLock = useCallback(async (layerId: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    await db.layers.update(layerId, { locked: !layer.locked });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l));
  }, [layers]);

  const changeOpacity = useCallback(async (layerId: number, val: number) => {
    await db.layers.update(layerId, { opacity: val });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity: val } : l));
  }, []);

  const changeBlendMode = useCallback(async (layerId: number, mode: string) => {
    await db.layers.update(layerId, { blendMode: mode });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, blendMode: mode } : l));
  }, []);

  // ─── Layer brightness/contrast/saturation adjust ──────────────────────────────
  const [showLayerAdjust, setShowLayerAdjust] = useState<number | null>(null);
  const [layerBright, setLayerBright] = useState(0);
  const [layerContrast, setLayerContrast]     = useState(0);
  const [layerSat, setLayerSat] = useState(0);

  const applyLayerAdjust = useCallback((layerId: number) => {
    if (!project || !currentFrame) return;
    const strokes = layerStrokes.current.get(layerId) ?? [];
    const CW = project.width, CH = project.height;
    const tmpC = document.createElement("canvas"); tmpC.width = CW; tmpC.height = CH;
    const tmpCtx = tmpC.getContext("2d")!;
    const map = new Map([[layerId, strokes]]);
    const thisLayer = layers.find(l => l.id === layerId);
    if (!thisLayer) return;
    compositeAllLayers(tmpCtx, [thisLayer], map, CW, CH, "transparent");
    const id = tmpCtx.getImageData(0, 0, CW, CH);
    const d = id.data;
    const br = layerBright / 100;
    const ct = layerContrast / 100;
    const sat = 1 + layerSat / 100;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i+3]! === 0) continue;
      let r = d[i]! / 255, g = d[i+1]! / 255, b = d[i+2]! / 255;
      // Brightness
      r += br; g += br; b += br;
      // Contrast
      r = (r - 0.5) * (1 + ct) + 0.5;
      g = (g - 0.5) * (1 + ct) + 0.5;
      b = (b - 0.5) * (1 + ct) + 0.5;
      // Saturation (luminance-preserving)
      const lum = 0.299*r + 0.587*g + 0.114*b;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
      d[i]   = Math.max(0, Math.min(255, r * 255));
      d[i+1] = Math.max(0, Math.min(255, g * 255));
      d[i+2] = Math.max(0, Math.min(255, b * 255));
    }
    tmpCtx.putImageData(id, 0, 0);
    // Convert to adjusted stroke list (single image stroke)
    const dataUrl = tmpC.toDataURL("image/png");
    const prevMap = new Map(layerStrokes.current);
    undoStack.current.push(prevMap); redoStack.current = [];
    const imageStroke = { tool: "image" as Tool, color: "#000000", size: 1, opacity: 1, points: [{x:0,y:0}], imageData: dataUrl, blendMode: "source-over" } as unknown as Stroke;
    layerStrokes.current = new Map(layerStrokes.current).set(layerId, [imageStroke]);
    redraw(); scheduleAutoSave();
    setShowLayerAdjust(null);
    setLayerBright(0); setLayerContrast(0); setLayerSat(0);
  }, [project, currentFrame, layers, layerBright, layerContrast, layerSat, redraw, scheduleAutoSave]);

  // ─── One-click pixel effects ─────────────────────────────────────────────────
  const applyPixelEffect = useCallback((layerId: number, effect: "grayscale"|"sepia"|"invert"|"pixelate"|"posterize") => {
    if (!project) return;
    const strokes = layerStrokes.current.get(layerId) ?? [];
    const CW = project.width, CH = project.height;
    const tmpC = document.createElement("canvas"); tmpC.width = CW; tmpC.height = CH;
    const tmpCtx = tmpC.getContext("2d")!;
    const thisLayer = layers.find(l => l.id === layerId);
    if (!thisLayer) return;
    compositeAllLayers(tmpCtx, [thisLayer], new Map([[layerId, strokes]]), CW, CH, "transparent");
    const id = tmpCtx.getImageData(0, 0, CW, CH);
    const d = id.data;
    if (effect === "grayscale") {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3]! === 0) continue;
        const g = 0.299*d[i]! + 0.587*d[i+1]! + 0.114*d[i+2]!;
        d[i] = d[i+1] = d[i+2] = g;
      }
    } else if (effect === "sepia") {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3]! === 0) continue;
        const r=d[i]!, g=d[i+1]!, b=d[i+2]!;
        d[i]   = Math.min(255, r*0.393+g*0.769+b*0.189);
        d[i+1] = Math.min(255, r*0.349+g*0.686+b*0.168);
        d[i+2] = Math.min(255, r*0.272+g*0.534+b*0.131);
      }
    } else if (effect === "invert") {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3]! === 0) continue;
        d[i]=255-d[i]!; d[i+1]=255-d[i+1]!; d[i+2]=255-d[i+2]!;
      }
    } else if (effect === "posterize") {
      const levels = 4;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3]! === 0) continue;
        d[i]   = Math.round(d[i]!   / 255 * (levels-1)) / (levels-1) * 255;
        d[i+1] = Math.round(d[i+1]! / 255 * (levels-1)) / (levels-1) * 255;
        d[i+2] = Math.round(d[i+2]! / 255 * (levels-1)) / (levels-1) * 255;
      }
    } else if (effect === "pixelate") {
      const block = Math.max(4, Math.round(Math.min(CW, CH) / 40));
      tmpCtx.putImageData(id, 0, 0);
      for (let y = 0; y < CH; y += block) {
        for (let x = 0; x < CW; x += block) {
          const px = tmpCtx.getImageData(x, y, 1, 1).data;
          tmpCtx.fillStyle = `rgba(${px[0]},${px[1]},${px[2]},${(px[3]??255)/255})`;
          tmpCtx.fillRect(x, y, block, block);
        }
      }
      const dataUrl = tmpC.toDataURL("image/png");
      const prevMap = new Map(layerStrokes.current);
      undoStack.current.push(prevMap); redoStack.current = [];
      const imgStroke = { tool:"pencil" as Tool, color:"#000000", size:1, opacity:100, points:[{x:0,y:0,pressure:1}], imageData: dataUrl } as unknown as Stroke;
      layerStrokes.current = new Map(layerStrokes.current).set(layerId, [imgStroke]);
      redraw(); scheduleAutoSave(); return;
    }
    tmpCtx.putImageData(id, 0, 0);
    const dataUrl = tmpC.toDataURL("image/png");
    const prevMap = new Map(layerStrokes.current);
    undoStack.current.push(prevMap); redoStack.current = [];
    const imgStroke = { tool:"pencil" as Tool, color:"#000000", size:1, opacity:100, points:[{x:0,y:0,pressure:1}], imageData: dataUrl } as unknown as Stroke;
    layerStrokes.current = new Map(layerStrokes.current).set(layerId, [imgStroke]);
    redraw(); scheduleAutoSave();
  }, [project, layers, redraw, scheduleAutoSave]);

  const moveLayerUp = useCallback(async (ridx: number) => {
    if (ridx <= 0) return;
    const a = sortedLayers[ridx]!, b = sortedLayers[ridx - 1]!;
    await db.layers.update(a.id, { order: b.order });
    await db.layers.update(b.id, { order: a.order });
    if (!currentFrame) return;
    const ls = await db.layers.listByFrame(currentFrame.id);
    setLayers(ls);
  }, [sortedLayers, currentFrame]);

  const moveLayerDown = useCallback(async (ridx: number) => {
    if (ridx >= sortedLayers.length - 1) return;
    const a = sortedLayers[ridx]!, b = sortedLayers[ridx + 1]!;
    await db.layers.update(a.id, { order: b.order });
    await db.layers.update(b.id, { order: a.order });
    if (!currentFrame) return;
    const ls = await db.layers.listByFrame(currentFrame.id);
    setLayers(ls);
  }, [sortedLayers, currentFrame]);

  const mergeDownLayer = useCallback(async (layerId: number) => {
    const sorted = [...layers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(l => l.id === layerId);
    if (idx <= 0) return;
    const above = sorted[idx]!, below = sorted[idx - 1]!;
    const aboveStrokes = layerStrokes.current.get(above.id) ?? [];
    const belowStrokes = layerStrokes.current.get(below.id) ?? [];
    const merged = [...belowStrokes, ...aboveStrokes];
    layerStrokes.current.set(below.id, merged);
    await db.layers.update(below.id, { canvasData: JSON.stringify({ strokes: merged }) });
    await deleteLayer(above.id);
  }, [layers, deleteLayer]);

  const mergeAllVisibleLayers = useCallback(async () => {
    const visibleSorted = [...layers].filter(l => l.visible).sort((a, b) => a.order - b.order);
    if (visibleSorted.length < 2) return;
    const bottom = visibleSorted[0]!;
    let merged: Stroke[] = layerStrokes.current.get(bottom.id) ?? [];
    for (const layer of visibleSorted.slice(1)) {
      const strokes = layerStrokes.current.get(layer.id) ?? [];
      merged = [...merged, ...strokes];
      await deleteLayer(layer.id);
    }
    layerStrokes.current.set(bottom.id, merged);
    await db.layers.update(bottom.id, { canvasData: JSON.stringify({ strokes: merged }) });
    redraw(); scheduleAutoSave();
  }, [layers, deleteLayer, redraw, scheduleAutoSave]);

  const clearCurrentLayer = useCallback(() => {
    if (!currentLayerId || currentLayer?.locked) return;
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, []);
    redraw(); scheduleAutoSave();
  }, [currentLayerId, currentLayer, redraw, scheduleAutoSave]);

  const renameLayer = useCallback(async (layerId: number, name: string) => {
    await db.layers.update(layerId, { name });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, name } : l));
  }, []);

  // ─── Undo / Redo ────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(new Map(layerStrokes.current));
    layerStrokes.current = undoStack.current.pop()!;
    redraw(); scheduleAutoSave();
  }, [redraw, scheduleAutoSave]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(new Map(layerStrokes.current));
    layerStrokes.current = redoStack.current.pop()!;
    redraw(); scheduleAutoSave();
  }, [redraw, scheduleAutoSave]);

  // ─── Drawing utilities ───────────────────────────────────────────────────────
  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number, pressure = 0.5;
    if ("touches" in e) {
      const t = e.touches[0]!;
      clientX = t.clientX; clientY = t.clientY;
      pressure = (t as Touch & { force?: number }).force || 0.5;
    } else {
      const me = e as React.MouseEvent;
      clientX = me.clientX; clientY = me.clientY;
    }
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    if (snapToGrid && gridSize > 0) {
      x = Math.round(x * CW / gridSize) * gridSize / CW;
      y = Math.round(y * CH / gridSize) * gridSize / CH;
    }
    return { x, y, pressure };
  }, [CW, CH, snapToGrid, gridSize]);

  const commitColor = useCallback((c: string) => {
    setColor(c);
    setRecentColors(prev => {
      const filtered = prev.filter(rc => rc !== c);
      return [c, ...filtered].slice(0, 8);
    });
  }, []);

  // Auto-extract dominant colours from the current merged canvas
  const extractPaletteFromCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
      const buckets = new Map<string, number>();
      const px = ctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          const a = px[i + 3]!;
          if (a < 20) continue;
          // quantise to 5-bit per channel
          const rq = (px[i]! >> 3) << 3;
          const gq = (px[i+1]! >> 3) << 3;
          const bq = (px[i+2]! >> 3) << 3;
          const key = `#${rq.toString(16).padStart(2,"0")}${gq.toString(16).padStart(2,"0")}${bq.toString(16).padStart(2,"0")}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
      }
      const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 8).map(([c]) => c);
      if (top.length > 0) {
        setRecentColors(top);
        // toast-style notification
        setAutoSaveMsg("Palette extracted from canvas!");
        setTimeout(() => setAutoSaveMsg(""), 2000);
      }
    } catch { /* tainted canvas in some envs */ }
  }, []);

  const flipH = useCallback(() => {
    if (!currentLayerId || currentLayer?.locked) return;
    const strokes = layerStrokes.current.get(currentLayerId) ?? [];
    const flipped = strokes.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: 1 - p.x })),
      textX: s.textX !== undefined ? 1 - s.textX : undefined,
    }));
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, flipped);
    redraw(); scheduleAutoSave();
  }, [currentLayerId, currentLayer, redraw, scheduleAutoSave]);

  const flipV = useCallback(() => {
    if (!currentLayerId || currentLayer?.locked) return;
    const strokes = layerStrokes.current.get(currentLayerId) ?? [];
    const flipped = strokes.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, y: 1 - p.y })),
      textY: s.textY !== undefined ? 1 - s.textY : undefined,
    }));
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, flipped);
    redraw(); scheduleAutoSave();
  }, [currentLayerId, currentLayer, redraw, scheduleAutoSave]);

  const copyLayer = useCallback(() => {
    if (!currentLayerId) return;
    const strokes = layerStrokes.current.get(currentLayerId) ?? [];
    localStorage.setItem("flipstudio_clipboard_layer", JSON.stringify(strokes));
  }, [currentLayerId]);

  const pasteLayer = useCallback(() => {
    if (!currentLayerId || currentLayer?.locked) return;
    const raw = localStorage.getItem("flipstudio_clipboard_layer");
    if (!raw) return;
    try {
      const strokes = JSON.parse(raw) as Stroke[];
      const prev = new Map(layerStrokes.current);
      undoStack.current.push(prev); redoStack.current = [];
      const existing = layerStrokes.current.get(currentLayerId) ?? [];
      layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, [...existing, ...strokes]);
      redraw(); scheduleAutoSave();
    } catch {}
  }, [currentLayerId, currentLayer, redraw, scheduleAutoSave]);

  const invert = useCallback(() => {
    if (!currentLayerId || currentLayer?.locked) return;
    const canvas = document.createElement("canvas");
    canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext("2d")!;
    const tmpCanvas = canvasRef.current;
    if (tmpCanvas) {
      ctx.drawImage(tmpCanvas, 0, 0);
      const id = ctx.getImageData(0, 0, CW, CH);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i]!   = 255 - id.data[i]!;
        id.data[i+1]! = 255 - id.data[i+1]!;
        id.data[i+2]! = 255 - id.data[i+2]!;
      }
      ctx.putImageData(id, 0, 0);
    }
  }, [currentLayerId, currentLayer, CW, CH]);

  const adjustBrightness = useCallback((amount: number) => {
    void amount; // placeholder - would use pixel manipulation
  }, []);

  // ─── Drawing events ──────────────────────────────────────────────────────────
  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isPlaying) return;
    e.preventDefault();
    setShowColorPanel(false);

    // Touch gesture detection
    if ("touches" in e && e.touches.length === 2) {
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      lastTouchDist.current = dist;
      lastTouchCenter.current = { x: cx, y: cy };
      touchPanStart.current = { x: cx, y: cy, ox: panOffset.x, oy: panOffset.y };
      isDrawing.current = false;
      return;
    }

    if (tool === "move") {
      const touch = "touches" in e ? e.touches[0]! : e as React.MouseEvent;
      panStart.current = { x: touch.clientX, y: touch.clientY, ox: panOffset.x, oy: panOffset.y };
      return;
    }

    const pos = getPos(e);

    if (tool === "eyedropper") {
      const ctx = canvasRef.current!.getContext("2d")!;
      const c = canvasRef.current!;
      const px = Math.floor(pos.x * c.width);
      const py = Math.floor(pos.y * c.height);
      const d = ctx.getImageData(Math.max(0, px), Math.max(0, py), 1, 1).data;
      const hex = "#" + [d[0]!, d[1]!, d[2]!].map(v => v.toString(16).padStart(2, "0")).join("");
      commitColor(hex);
      return;
    }

    if (tool === "text") {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0]!.clientX : (e as React.MouseEvent).clientX;
      const cy = "touches" in e ? e.touches[0]!.clientY : (e as React.MouseEvent).clientY;
      setTextInput({ x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height, val: "" });
      return;
    }

    if (tool === "fill") {
      if (!currentLayerId || currentLayer?.locked) return;
      const prev = new Map(layerStrokes.current);
      undoStack.current.push(prev); redoStack.current = [];
      const cur = [...(layerStrokes.current.get(currentLayerId) ?? [])];
      cur.push({ tool: "fill", color, size, opacity, points: [pos] });
      layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, cur);
      redraw(); scheduleAutoSave();
      return;
    }

    if (tool === "gradient") {
      if (!currentLayerId || currentLayer?.locked) return;
      const prev = new Map(layerStrokes.current);
      undoStack.current.push(prev); redoStack.current = [];
      const stroke = { tool: "gradient" as Tool, color, color2, size, opacity, points: [pos, { ...pos }], gradientType } as unknown as Stroke;
      curStroke.current = stroke;
      allCurStrokes.current = [stroke];
      isDrawing.current = true;
      return;
    }

    if (tool === "select") {
      isDrawing.current = true;
      curStroke.current = { tool: "select" as Tool, color, size, opacity, points: [pos, { ...pos }] };
      return;
    }

    if (currentLayer?.locked || !currentLayerId) return;

    isDrawing.current = true;
    const freehand = ["pencil","pen","brush","eraser","chalk","marker","watercolor","spray","calligraphy"].includes(tool);
    if (freehand) {
      // Stabilizer buffer
      const stroke: Stroke = { tool, color, size, opacity, points: [pos], hardness, flow };
      const symmPoints = getSymmetryPoints(pos, symmetryMode);
      if (symmPoints.length > 1) {
        allCurStrokes.current = symmPoints.map(sp => ({ ...stroke, points: [sp] }));
        const prev = new Map(layerStrokes.current);
        undoStack.current.push(prev); redoStack.current = [];
        curStroke.current = allCurStrokes.current[0]!;
      } else {
        allCurStrokes.current = [stroke];
        const prev = new Map(layerStrokes.current);
        undoStack.current.push(prev); redoStack.current = [];
        curStroke.current = stroke;
      }
    } else {
      const stroke: Stroke = {
        tool, color, size, opacity, points: [pos, { ...pos }],
        filled: filledShape, sides: polygonSides,
      };
      const prev = new Map(layerStrokes.current);
      undoStack.current.push(prev); redoStack.current = [];
      curStroke.current = stroke;
      // *** CRITICAL FIX: allCurStrokes must be set for shape tools so endDraw can commit ***
      allCurStrokes.current = [stroke]; // shares object reference – continueDraw mutations reflected here
    }
  }, [isPlaying, tool, panOffset, getPos, currentLayerId, currentLayer, color, color2, gradientType, size, opacity, hardness, flow, symmetryMode, filledShape, polygonSides, commitColor, redraw, scheduleAutoSave]);

  const continueDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Pinch-to-zoom
    if ("touches" in e && e.touches.length === 2) {
      const t0 = e.touches[0]!, t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      if (lastTouchDist.current !== null) {
        const scale = dist / lastTouchDist.current;
        setZoom(z => Math.max(0.1, Math.min(8, z * scale)));
      }
      if (touchPanStart.current) {
        setPanOffset({
          x: touchPanStart.current.ox + (cx - touchPanStart.current.x),
          y: touchPanStart.current.oy + (cy - touchPanStart.current.y),
        });
      }
      lastTouchDist.current = dist;
      lastTouchCenter.current = { x: cx, y: cy };
      return;
    }

    if (tool === "move" && panStart.current) {
      const touch = "touches" in e ? e.touches[0]! : e as React.MouseEvent;
      setPanOffset({
        x: panStart.current.ox + (touch.clientX - panStart.current.x),
        y: panStart.current.oy + (touch.clientY - panStart.current.y),
      });
      return;
    }

    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);

    if (tool === "select") {
      if (!curStroke.current) return;
      const p0 = curStroke.current.points[0]!;
      setSelectionRect({ x: Math.min(p0.x, pos.x), y: Math.min(p0.y, pos.y), w: Math.abs(pos.x - p0.x), h: Math.abs(pos.y - p0.y) });
      return;
    }

    const freehand = ["pencil","pen","brush","eraser","chalk","marker","watercolor","spray","calligraphy"].includes(tool);
    if (freehand) {
      if (!curStroke.current || !currentLayerId) return;
      const symmPoints = getSymmetryPoints(pos, symmetryMode);

      // Speed-based pressure: slow strokes → thicker, fast strokes → thinner
      let speedPressureMod = 1;
      if (speedPressure) {
        const now = performance.now();
        const dt = Math.max(1, now - lastDrawTime.current);
        const dx = lastDrawPos.current ? (pos.x - lastDrawPos.current.x) * (canvasRef.current?.width ?? 1000) : 0;
        const dy = lastDrawPos.current ? (pos.y - lastDrawPos.current.y) * (canvasRef.current?.height ?? 1000) : 0;
        const speed = Math.sqrt(dx*dx + dy*dy) / dt; // px/ms
        speedPressureMod = Math.max(0.2, Math.min(1.5, 1 / (1 + speed * 3)));
        lastDrawTime.current = now;
        lastDrawPos.current = { x: pos.x, y: pos.y };
      }

      // Apply stabilizer (lazy brush)
      for (let si = 0; si < allCurStrokes.current.length; si++) {
        const stroke = allCurStrokes.current[si]!;
        const sp = symmPoints[si] ?? pos;
        const lastPt = stroke.points[stroke.points.length - 1]!;
        const stab = Math.max(0, Math.min(9, brushStabilizer));
        const t = stab === 0 ? 1 : 1 / (stab + 1);
        const sx = lastPt.x + (sp.x - lastPt.x) * t;
        const sy = lastPt.y + (sp.y - lastPt.y) * t;
        const stabPt: Point = { x: sx, y: sy, pressure: sp.pressure * speedPressureMod };
        stroke.points.push(stabPt);
      }

      // Render incremental on overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d")!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        for (const stroke of allCurStrokes.current) {
          renderSingleStroke(ctx, stroke, overlay.width, overlay.height);
        }
      }
    } else {
      // Shape preview
      if (!curStroke.current) return;
      curStroke.current.points[curStroke.current.points.length - 1] = pos;
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d")!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        renderSingleStroke(ctx, curStroke.current, overlay.width, overlay.height);
      }
    }
  }, [tool, panOffset, getPos, currentLayerId, symmetryMode, brushStabilizer, speedPressure]);

  const endDraw = useCallback(() => {
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
    touchPanStart.current = null;
    panStart.current = null;

    if (!isDrawing.current) return;
    isDrawing.current = false;

    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d")!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    if (tool === "select") {
      curStroke.current = null;
      return;
    }

    if (!currentLayerId || !curStroke.current) return;

    // Commit all symmetry strokes
    const existing = layerStrokes.current.get(currentLayerId) ?? [];
    const newStrokes = [...existing, ...allCurStrokes.current];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, newStrokes);
    curStroke.current = null;
    allCurStrokes.current = [];
    redraw();
    scheduleAutoSave();
  }, [tool, currentLayerId, redraw, scheduleAutoSave]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom(z => Math.max(0.1, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    } else {
      setPanOffset(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  // Swipe panel gestures
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    swipeStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - swipeStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0) setShowLayersPanel(true);   // swipe left → layers
      else setShowLayersPanel(false);           // swipe right → hide layers
    }
    swipeStartX.current = null;
  }, []);

  // Commit text
  const commitText = useCallback((val: string) => {
    if (!textInput || !val.trim() || !currentLayerId || currentLayer?.locked) {
      setTextInput(null); return;
    }
    const fontStr = `${textItalic ? "italic " : ""}${textBold ? "bold " : ""}normal`;
    const stroke: Stroke = {
      tool: "text", color, size, opacity, points: [{ x: textInput.x, y: textInput.y, pressure: 1 }],
      text: val, textX: textInput.x, textY: textInput.y, textSize: size * 5,
      fontFamily: textFont, fontStyle: fontStr,
    };
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    const existing = layerStrokes.current.get(currentLayerId) ?? [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, [...existing, stroke]);
    setTextInput(null);
    redraw(); scheduleAutoSave();
  }, [textInput, currentLayerId, currentLayer, color, size, opacity, textFont, textBold, textItalic, redraw, scheduleAutoSave]);

  // ─── Quick erase (hold Alt to temporarily erase, release to restore) ─────────
  const toolBeforeAlt = useRef<Tool | null>(null);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Alt" && !e.repeat) {
        setTool(prev => { toolBeforeAlt.current = prev; return "eraser"; });
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" && toolBeforeAlt.current) {
        const prev = toolBeforeAlt.current;
        toolBeforeAlt.current = null;
        setTool(prev);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || textInput) return;
      const map: Record<string, Tool> = {
        p:"pencil", n:"pen", b:"brush", h:"chalk", m:"marker", w:"watercolor",
        y:"spray", g:"calligraphy", e:"eraser", f:"fill", i:"eyedropper",
        v:"move", s:"select", l:"line", r:"rect", o:"ellipse", t:"triangle",
        a:"arrow", k:"star", q:"polygon", x:"text",
      };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && map[e.key.toLowerCase()]) {
        setTool(map[e.key.toLowerCase()]!);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copyLayer(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); pasteLayer(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); void duplicateFrame(currentFrameIdx); }
      if ((e.ctrlKey || e.metaKey) && e.key === "=") { e.preventDefault(); setZoom(z => Math.min(16, z * 1.25)); }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); setZoom(z => Math.max(0.1, z * 0.8)); }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); setZoom(1); setPanOffset({ x: 0, y: 0 }); }
      if (e.key === "ArrowLeft" && !e.ctrlKey) { e.preventDefault(); void switchFrame(currentFrameIdx - 1); }
      if (e.key === "ArrowRight" && !e.ctrlKey) { e.preventDefault(); void switchFrame(currentFrameIdx + 1); }
      if (e.key === "[") { setSize(s => Math.max(1, s - 2)); }
      if (e.key === "]") { setSize(s => Math.min(200, s + 2)); }
      if (e.key === "X" && e.shiftKey && !e.ctrlKey) {
        // Swap primary ↔ secondary colour (Shift+X, like Photoshop)
        setColor(prev => { const next = prev; setColor2(c2prev => { setColor(c2prev); return next; }); return prev; });
      }
      if (e.key === " ") { e.preventDefault(); if (isPlaying) setIsPlaying(false); else setIsPlaying(true); }
      if (e.key === "Escape") { setIsPlaying(false); setTextInput(null); setSelectionRect(null); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionRect && currentLayerId && !currentLayer?.locked) {
          // Clear selection area
          const strokes = layerStrokes.current.get(currentLayerId) ?? [];
          const { x: sx, y: sy, w: sw, h: sh } = selectionRect;
          const filtered = strokes.filter(s => !s.points.every(p => p.x >= sx && p.x <= sx+sw && p.y >= sy && p.y <= sy+sh));
          const prev = new Map(layerStrokes.current);
          undoStack.current.push(prev); redoStack.current = [];
          layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, filtered);
          setSelectionRect(null);
          redraw(); scheduleAutoSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput, undo, redo, copyLayer, pasteLayer, duplicateFrame, switchFrame, frames.length, isPlaying, selectionRect, currentLayerId, currentLayer, currentFrameIdx, redraw, scheduleAutoSave]);

  // ─── Export single frame ─────────────────────────────────────────────────────
  const exportCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `frame_${currentFrameIdx + 1}.png`;
    a.click();
  }, [currentFrameIdx]);

  // ─── GIF Export ───────────────────────────────────────────────────────────────
  const [isExportingGif, setIsExportingGif] = useState(false);
  const exportGif = useCallback(async () => {
    if (!project || frames.length === 0) return;
    setIsExportingGif(true);
    try {
      // Load gif.js dynamically from CDN
      const GIF = await new Promise<any>((resolve, reject) => {
        if ((window as any).GIF) { resolve((window as any).GIF); return; }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
        script.onload = () => resolve((window as any).GIF);
        script.onerror = () => reject(new Error("Failed to load gif.js"));
        document.head.appendChild(script);
      });

      const W = project.width ?? 800;
      const H = project.height ?? 600;
      const fps = project.fps ?? 12;
      const delay = Math.round(1000 / fps);

      const gif = new GIF({
        workers: 2,
        quality: 8,
        width: W,
        height: H,
        workerScript: "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js",
      });

      // Render each frame to a temporary canvas
      for (let fi = 0; fi < frames.length; fi++) {
        const frame = frames[fi];
        const tmp = document.createElement("canvas");
        tmp.width = W; tmp.height = H;
        const ctx = tmp.getContext("2d")!;

        // Get strokes for all layers in this frame
        const frameLayers = layers.filter(l => l.frameId === frame.id);
        const layerStrokes = new Map<number, import("../lib/rendering").Stroke[]>();
        for (const layer of frameLayers) {
          const data = import("../lib/rendering").then(m => m.safeParseCanvas(layer.canvasData));
          layerStrokes.set(layer.id, (await data).strokes);
        }

        const { compositeAllLayers } = await import("../lib/rendering");
        compositeAllLayers(ctx, frameLayers, layerStrokes, W, H, project.backgroundColor ?? "#ffffff");
        gif.addFrame(tmp, { delay, copy: true });
      }

      gif.on("finished", (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name ?? "animation"}.gif`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExportingGif(false);
      });

      gif.render();
    } catch (err) {
      console.error("GIF export failed", err);
      setIsExportingGif(false);
    }
  }, [project, frames, layers]);

  // ─── PNG sequence ZIP export ─────────────────────────────────────────────────
  const [isExportingPng, setIsExportingPng] = useState(false);
  const exportPngSequence = useCallback(async () => {
    if (!project || frames.length === 0) return;
    setIsExportingPng(true);
    try {
      const JSZip = await new Promise<any>((resolve, reject) => {
        if ((window as any).JSZip) { resolve((window as any).JSZip); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        s.onload = () => resolve((window as any).JSZip);
        s.onerror = () => reject(new Error("Failed to load JSZip"));
        document.head.appendChild(s);
      });

      const W = project.width ?? 800;
      const H = project.height ?? 600;
      const { compositeAllLayers, safeParseCanvas: spc } = await import("../lib/rendering");
      const zip = new JSZip();
      const folder = zip.folder(project.name ?? "frames")!;

      for (let fi = 0; fi < frames.length; fi++) {
        const frame = frames[fi];
        const tmp = document.createElement("canvas");
        tmp.width = W; tmp.height = H;
        const ctx = tmp.getContext("2d")!;
        const frameLayers = layers.filter(l => l.frameId === frame.id);
        const lsMap = new Map<number, import("../lib/rendering").Stroke[]>();
        for (const l of frameLayers) lsMap.set(l.id, spc(l.canvasData).strokes);
        compositeAllLayers(ctx, frameLayers, lsMap, W, H, project.backgroundColor ?? "#ffffff");
        const blob: Blob = await new Promise(r => tmp.toBlob(b => r(b!), "image/png"));
        const arr = await blob.arrayBuffer();
        folder.file(`frame_${String(fi + 1).padStart(4, "0")}.png`, arr);
      }

      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url; a.download = `${project.name ?? "animation"}_frames.zip`; a.click();
      URL.revokeObjectURL(url);
      setIsExportingPng(false);
    } catch (err) {
      console.error("PNG sequence export failed", err);
      setIsExportingPng(false);
    }
  }, [project, frames, layers]);

  // ─── Canvas resize ────────────────────────────────────────────────────────────
  const applyCanvasResize = useCallback(async () => {
    if (!project) return;
    const w = Math.max(64, Math.min(4096, resizeW));
    const h = Math.max(64, Math.min(4096, resizeH));
    await db.projects.update(projectId, { width: w, height: h });
    setProject(p => p ? { ...p, width: w, height: h } : p);
    setShowResizeDialog(false);
    redraw();
  }, [project, projectId, resizeW, resizeH, redraw]);

  // ─── WebM video export ────────────────────────────────────────────────────────
  const exportWebm = useCallback(async () => {
    if (!project || frames.length === 0) return;
    setIsExportingWebm(true);
    try {
      const W = project.width ?? 800;
      const H = project.height ?? 600;
      const fps = project.fps ?? 12;
      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = W; tmpCanvas.height = H;
      const tmpCtx = tmpCanvas.getContext("2d")!;

      const stream = tmpCanvas.captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${project.name ?? "animation"}.webm`; a.click();
        URL.revokeObjectURL(url);
        setIsExportingWebm(false);
      };

      recorder.start();
      const { compositeAllLayers, safeParseCanvas: spc } = await import("../lib/rendering");
      const frameDelay = Math.round(1000 / fps);

      for (let fi = 0; fi < frames.length; fi++) {
        const frame = frames[fi];
        const frameLayers = layers.filter(l => l.frameId === frame.id);
        const layerStrokesMap = new Map<number, import("../lib/rendering").Stroke[]>();
        for (const layer of frameLayers) layerStrokesMap.set(layer.id, spc(layer.canvasData).strokes);
        compositeAllLayers(tmpCtx, frameLayers, layerStrokesMap, W, H, project.backgroundColor ?? "#ffffff");
        const delay = (frame.duration && frame.duration > 0) ? frame.duration : frameDelay;
        await new Promise(r => setTimeout(r, delay));
      }

      recorder.stop();
    } catch (err) {
      console.error("WebM export failed", err);
      setIsExportingWebm(false);
    }
  }, [project, frames, layers]);

  // ─── Per-frame delay ──────────────────────────────────────────────────────────
  const updateFrameDelay = useCallback(async (frameIdx: number, delayMs: number) => {
    const frame = frames[frameIdx];
    if (!frame) return;
    await db.frames.update(frame.id, { duration: delayMs });
    setFrames(prev => prev.map((f, i) => i === frameIdx ? { ...f, duration: delayMs } : f));
  }, [frames]);

  const updateFrameLabel = useCallback(async (frameIdx: number, label: string) => {
    const frame = frames[frameIdx];
    if (!frame) return;
    await db.frames.update(frame.id, { label });
    setFrames(prev => prev.map((f, i) => i === frameIdx ? { ...f, label } : f));
    setEditingFrameLabel(null);
  }, [frames]);

  const updateFrameHold = useCallback(async (frameIdx: number, hold: number) => {
    const frame = frames[frameIdx];
    if (!frame) return;
    const h = Math.max(1, Math.min(99, hold));
    await db.frames.update(frame.id, { hold: h });
    setFrames(prev => prev.map((f, i) => i === frameIdx ? { ...f, hold: h } : f));
  }, [frames]);

  const copyLayerToFrame = useCallback(async (targetFrameIdx: number) => {
    if (!currentLayerId || !currentLayer) return;
    const targetFrame = frames[targetFrameIdx];
    if (!targetFrame) return;
    const strokes = layerStrokes.current.get(currentLayerId) ?? [];
    const existingLayers = await db.layers.listByFrame(targetFrame.id);
    const maxOrder = existingLayers.reduce((m, l) => Math.max(m, l.order), 0);
    await db.layers.create({
      frameId: targetFrame.id, projectId, name: `${currentLayer.name} (copy)`,
      order: maxOrder + 1, visible: true, locked: false,
      opacity: currentLayer.opacity, blendMode: currentLayer.blendMode,
      canvasData: JSON.stringify({ strokes }),
    });
    toast({ title: `Layer copied to frame ${targetFrameIdx + 1}` });
  }, [currentLayerId, currentLayer, frames, projectId, layerStrokes]);

  const [copyToFrameOpen, setCopyToFrameOpen] = useState(false);

  // ─── Background color ─────────────────────────────────────────────────────────
  const changeBgColor = useCallback(async (newColor: string) => {
    if (!project) return;
    await db.projects.update(projectId, { backgroundColor: newColor });
    setProject(p => p ? { ...p, backgroundColor: newColor } : p);
    redraw();
  }, [project, projectId, redraw]);

  // ─── Rename project ──────────────────────────────────────────────────────────
  const saveProjectName = useCallback(async () => {
    if (!projectNameVal.trim()) return;
    await db.projects.update(projectId, { name: projectNameVal });
    setProject(p => p ? { ...p, name: projectNameVal } : p);
    setShowRenameProject(false);
  }, [projectId, projectNameVal]);

  // ─── Reference image ─────────────────────────────────────────────────────────
  const loadRefImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
      setShowRefImage(true);
      setShowRefPanel(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // ─── Audio recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = ev => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        stream.getTracks().forEach(t => t.stop());
        const reader2 = new FileReader();
        reader2.onload = async () => {
          await db.projects.update(projectId, { audioTrack: reader2.result as string });
        };
        reader2.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // Mic permission denied or unavailable
    }
  }, [projectId]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const clearAudio = useCallback(async () => {
    if (audioElemRef.current) { audioElemRef.current.pause(); audioElemRef.current.src = ""; }
    setAudioURL(null);
    await db.projects.update(projectId, { audioTrack: undefined });
  }, [projectId]);

  // ─── Render loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg,#200d45 0%,#0d0d2b 50%,#0b1530 100%)" }}>
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)" }}>
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" style={{ borderTopColor: "transparent" }}/>
          <p className="text-lg font-semibold" style={{ color: "#c4b5fd" }}>Opening project…</p>
          <p className="text-sm" style={{ color: "rgba(196,181,253,0.5)" }}>Loading your canvas</p>
        </div>
      </div>
    </div>
  );
  if (!project) return null;

  // canvasDisplayW is computed by the JS resize effect above — avoids CSS min() Android bug

  return (
    <div className="w-screen flex flex-col bg-[#060610] text-white overflow-hidden select-none page-enter" style={{ height: "100dvh" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* ── Top Bar ── */}
        <div className="h-10 flex items-center border-b border-white/[0.06] bg-[#0b0b18] shrink-0 z-20">

          {/* Fixed LEFT: back + project name */}
          <div className="flex items-center gap-1 px-1 shrink-0">
            <button className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors active:scale-95"
              onClick={async () => { await saveCurrentLayerData(); setLocation("/"); }}>
              <ArrowLeft className="w-5 h-5"/>
            </button>
            {showRenameProject ? (
              <input autoFocus value={projectNameVal} onChange={e => setProjectNameVal(e.target.value)}
                onBlur={saveProjectName}
                onKeyDown={e => { if (e.key === "Enter") void saveProjectName(); if (e.key === "Escape") setShowRenameProject(false); }}
                className="bg-white/8 border border-violet-500/30 rounded-lg text-sm font-bold text-white px-2 py-1 outline-none w-32"/>
            ) : (
              <button className="text-sm font-bold text-white/80 hover:text-white transition-colors max-w-[110px] truncate"
                onClick={() => setShowRenameProject(true)}>
                {project.name}
              </button>
            )}
            {/* Auto-save indicator */}
            {saveStatus !== "idle" && (
              <span className={cn("text-[10px] transition-all shrink-0",
                saveStatus === "saving" ? "text-white/25" : "text-emerald-400/70")}>
                {saveStatus === "saving" ? "saving…" : "✓ saved"}
              </span>
            )}
          </div>

          {/* Scrollable CENTER: symmetry + grid + undo/redo */}
          <div className="flex-1 flex items-center gap-0.5 overflow-x-auto px-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 shrink-0">
              {SYMMETRY_OPTIONS.map(m => (
                <Tooltip key={m}>
                  <TooltipTrigger asChild>
                    <button className={cn("w-7 h-6 rounded text-[9px] font-bold transition-all",
                      symmetryMode === m ? "bg-violet-600 text-white" : "text-white/30 hover:text-white hover:bg-white/8")}
                      onClick={() => setSymmetryMode(m)}>
                      {m === "none" ? "OFF" : m === "horizontal" ? "H" : m === "vertical" ? "V" : m === "both" ? "HV" : m === "radial4" ? "4X" : "8X"}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{m === "none" ? "No Symmetry" : m + " Symmetry"}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <button onClick={() => setShowGrid(s => !s)} title="Grid"
              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                showGrid ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/8")}>
              <Grid3X3 className="w-4 h-4"/>
            </button>
            <button onClick={() => { setResizeW(project?.width ?? 800); setResizeH(project?.height ?? 600); setShowResizeDialog(true); }}
              title="Resize Canvas"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors shrink-0">
              <Maximize2 className="w-4 h-4"/>
            </button>
            {/* Background color picker */}
            <div className="relative shrink-0">
              <button title="Canvas Background Color" onClick={() => setShowBgPicker(p => !p)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-white/15 hover:border-white/30 transition-all overflow-hidden">
                <div className="w-full h-full rounded" style={{ background: project?.backgroundColor === "transparent" ? "linear-gradient(45deg,#ccc 25%,#fff 25%,#fff 75%,#ccc 75%)" : project?.backgroundColor ?? "#ffffff" }}/>
              </button>
              {showBgPicker && (
                <div className="absolute top-10 left-0 z-50 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl p-3 w-52">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Canvas Background</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {["#ffffff","#000000","#111111","#1a1a2e","#fef3c7","#ecfdf5","#eff6ff","#fdf4ff","#fff7ed","transparent"].map(c => (
                      <button key={c} onClick={() => { void changeBgColor(c); setShowBgPicker(false); }}
                        className={cn("w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                          project?.backgroundColor === c ? "border-violet-500" : "border-white/15")}
                        style={{ background: c === "transparent" ? "linear-gradient(45deg,#888 25%,#fff 25%,#fff 75%,#888 75%)" : c }}
                        title={c}/>
                    ))}
                  </div>
                  <input type="color" value={project?.backgroundColor === "transparent" ? "#ffffff" : (project?.backgroundColor ?? "#ffffff")}
                    onChange={e => void changeBgColor(e.target.value)}
                    className="w-full h-9 rounded-xl cursor-pointer bg-transparent border border-white/10"/>
                </div>
              )}
            </div>
            <div className="w-px h-5 bg-white/[0.07] shrink-0"/>
            <button onClick={undo} title="Undo" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors shrink-0">
              <Undo2 className="w-4 h-4"/>
            </button>
            <button onClick={redo} title="Redo" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors shrink-0">
              <Redo2 className="w-4 h-4"/>
            </button>
          </div>

          {/* Fixed RIGHT: Export always visible, never scrolls off */}
          <div className="flex items-center gap-1 px-1.5 shrink-0">
            <button onClick={exportCurrentFrame} title="Save frame as PNG"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors">
              <Film className="w-4 h-4"/>
            </button>
            <button onClick={() => void exportGif()} disabled={isExportingGif}
              title="Export all frames as animated GIF"
              className="flex items-center gap-1 px-2.5 h-9 rounded-xl text-[12px] font-bold bg-emerald-700/60 hover:bg-emerald-600/70 text-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait shrink-0">
              {isExportingGif ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> GIF…</> : <>GIF</>}
            </button>
            <button onClick={() => void exportWebm()} disabled={isExportingWebm}
              title="Export animation as WebM video"
              className="flex items-center gap-1 px-2.5 h-9 rounded-xl text-[12px] font-bold bg-sky-700/60 hover:bg-sky-600/70 text-sky-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait shrink-0">
              {isExportingWebm ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> MP4…</> : <>WebM</>}
            </button>
            <button onClick={() => void exportPngSequence()} disabled={isExportingPng}
              title="Export all frames as PNG sequence (ZIP)"
              className="flex items-center gap-1 px-2.5 h-9 rounded-xl text-[12px] font-bold bg-orange-700/60 hover:bg-orange-600/70 text-orange-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait shrink-0">
              {isExportingPng ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> ZIP…</> : <>PNGs</>}
            </button>
            <button onClick={() => setLocation("/projects/" + projectId + "/export")}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-all shadow-lg shadow-violet-900/30 active:scale-95 shrink-0">
              <Download className="w-4 h-4"/> Export
            </button>
          </div>
        </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Tool Bar ── */}
        <div className="w-13 flex flex-col items-center bg-[#0b0b18] border-r border-white/[0.06] shrink-0 overflow-y-auto py-1" style={{ width: 52 }}>
          {/* Group: draw */}
          <div className="w-full flex flex-col items-center gap-0 px-1 mb-0.5">
            {ALL_TOOLS.filter(t => t.group === "draw").map(t => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    tool === t.id ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                    onClick={() => setTool(t.id)}>{t.icon}</button>
                </TooltipTrigger>
                <TooltipContent side="right">{t.label} ({t.shortcut})</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-6 h-px bg-white/[0.06] mb-0.5"/>

          {/* Group: nav */}
          <div className="w-full flex flex-col items-center gap-0 px-1 mb-0.5">
            {ALL_TOOLS.filter(t => t.group === "nav").map(t => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    tool === t.id ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                    onClick={() => setTool(t.id)}>{t.icon}</button>
                </TooltipTrigger>
                <TooltipContent side="right">{t.label} ({t.shortcut})</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-6 h-px bg-white/[0.06] mb-0.5"/>

          {/* Group: shape */}
          <div className="w-full flex flex-col items-center gap-0 px-1 mb-0.5">
            {ALL_TOOLS.filter(t => t.group === "shape").map(t => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    tool === t.id ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
                    onClick={() => setTool(t.id)}>{t.icon}</button>
                </TooltipTrigger>
                <TooltipContent side="right">{t.label} ({t.shortcut})</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="w-6 h-px bg-white/[0.06] mb-0.5"/>

          {/* Color swatch — tap to open full color panel */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative w-10 h-10 cursor-pointer" onClick={() => setShowColorPanel(p => !p)}>
                  <div className="absolute inset-0 rounded-xl border-[3px] transition-all shadow-lg"
                    style={{ backgroundColor: color, borderColor: showColorPanel ? "#a78bfa" : "rgba(255,255,255,0.2)" }}/>
                  {/* Secondary color (bottom-right) — for gradient tool */}
                  <div className="absolute bottom-0 right-0 w-4 h-4 rounded-md border-2 border-[#0e0e1a] shadow"
                    style={{ backgroundColor: color2 }}>
                    <label className="absolute inset-0 cursor-pointer opacity-0 w-full h-full">
                      <input type="color" value={color2}
                        onChange={e => { e.stopPropagation(); setColor2(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full h-full opacity-0 cursor-pointer"/>
                    </label>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Primary / Secondary colour (secondary used by gradient tool — click corner to change)</TooltipContent>
            </Tooltip>

            {/* Always-visible quick color strip */}
            <div className="w-full flex flex-col items-center gap-0.5 px-1 mt-1 mb-1">
              {(["#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899"] as const).map(c => (
                <button key={c}
                  className="w-9 h-9 rounded-lg border-2 transition-all active:scale-95"
                  style={{ backgroundColor: c, borderColor: color === c ? "#a78bfa" : "rgba(255,255,255,0.06)" }}
                  onClick={() => commitColor(c)}/>
              ))}
            </div>

            <div className="w-6 h-px bg-white/[0.06] my-0.5"/>

                      {/* Quick actions */}
          <Tooltip><TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={flipH}>
              <FlipHorizontal2 className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Flip Horizontal</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={flipV}>
              <FlipVIcon/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Flip Vertical</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={copyLayer}>
              <Copy className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Copy Layer (Ctrl+C)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={pasteLayer}>
              <Clipboard className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Paste Layer (Ctrl+V)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-10 h-10 rounded-xl text-red-400/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center" onClick={clearCurrentLayer}>
              <Trash2 className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Clear Layer</TooltipContent></Tooltip>

          <div className="w-6 h-px bg-white/[0.06] my-0.5"/>

          {/* Brush settings toggle */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              showBrushPanel ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => setShowBrushPanel(p => !p)}>
              <SlidersHorizontal className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Brush Settings</TooltipContent></Tooltip>

          {/* Layers panel toggle */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              showLayersPanel ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => setShowLayersPanel(p => !p)}>
              <Layers className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Layers Panel (swipe)</TooltipContent></Tooltip>

          <div className="w-6 h-px bg-white/[0.06] my-0.5"/>

          {/* Reference image */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all relative",
              showRefPanel ? "bg-fuchsia-600/30 text-fuchsia-300" : refImage ? "text-fuchsia-400/60 hover:text-fuchsia-300 hover:bg-white/[0.06]" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => refImage ? setShowRefPanel(p => !p) : refInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4"/>
              {refImage && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-fuchsia-500"/>}
            </button>
          </TooltipTrigger><TooltipContent side="right">Reference Image</TooltipContent></Tooltip>

          {/* Audio track */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all relative",
              isRecording ? "bg-red-600/40 text-red-300 animate-pulse" : audioURL ? "text-fuchsia-400/60 hover:text-fuchsia-300 hover:bg-white/[0.06]" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => isRecording ? stopRecording() : setShowAudioBar(p => !p)}>
              <Music2 className="w-4 h-4"/>
              {audioURL && !isRecording && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-fuchsia-500"/>}
            </button>
          </TooltipTrigger><TooltipContent side="right">{isRecording ? "Stop Recording" : "Audio Track"}</TooltipContent></Tooltip>
        </div>

        {/* ── Color Panel ── */}
        {showColorPanel && (
          <div className="absolute left-14 top-2 z-40 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl w-64"
            style={{ maxHeight: "calc(100% - 16px)", overflowY: "auto" }}>
            <div className="flex items-center justify-between p-3 pb-0">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Color</span>
              <button className="text-white/20 hover:text-white" onClick={() => setShowColorPanel(false)}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="p-3">
              <ColorWheel value={color} onChange={commitColor}/>
              {/* HEX input */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-white/35 w-8">#HEX</span>
                <input className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg text-xs text-white px-2 py-1 outline-none focus:border-violet-500/50"
                  value={color.replace("#","")}
                  onChange={e => {
                    const v = "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                    if (v.length === 7) commitColor(v);
                  }}/>
                <div className="w-6 h-6 rounded border border-white/15" style={{ backgroundColor: color }}/>
              </div>
              {/* RGB sliders */}
              {[["R","r"],["G","g"],["B","b"]].map(([label, ch]) => {
                const idx = ch === "r" ? 1 : ch === "g" ? 3 : 5;
                const val = parseInt(color.slice(idx, idx + 2), 16) || 0;
                return (
                  <div key={ch} className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-white/30 w-4">{label}</span>
                    <Slider value={[val]} min={0} max={255} step={1}
                      onValueChange={([v]) => {
                        const r = ch === "r" ? v! : (parseInt(color.slice(1,3),16)||0);
                        const g = ch === "g" ? v! : (parseInt(color.slice(3,5),16)||0);
                        const b = ch === "b" ? v! : (parseInt(color.slice(5,7),16)||0);
                        commitColor("#" + [r,g,b].map(n=>n.toString(16).padStart(2,"0")).join(""));
                      }}
                      className="flex-1 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"/>
                    <span className="text-[10px] text-white/25 w-7 text-right">{val}</span>
                  </div>
                );
              })}
              {/* Color Palettes */}
              <div className="mt-3">
                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  {Object.keys(COLOR_PALETTES).map(name => (
                    <button key={name}
                      onClick={() => setActivePalette(name)}
                      className={cn("text-[9px] px-1.5 py-0.5 rounded-full border transition-all",
                        activePalette === name
                          ? "border-violet-500 text-violet-300 bg-violet-600/15"
                          : "border-white/10 text-white/30 hover:border-white/20"
                      )}>
                      {name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(COLOR_PALETTES[activePalette] ?? COLOR_PALETTES["Classic"]!).map(c => (
                    <button key={c} className="w-6 h-6 rounded-lg border-2 transition-all hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? "#8b5cf6" : "transparent" }}
                      onClick={() => commitColor(c)}/>
                  ))}
                </div>
              </div>
              {/* Recent colors */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Recent</span>
                  <button
                    onClick={extractPaletteFromCanvas}
                    title="Extract dominant colours from canvas"
                    className="text-[9px] text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/60 rounded px-1.5 py-0.5 transition-all">
                    ⬡ Extract from canvas
                  </button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {recentColors.map((c, i) => (
                    <button key={i} className="w-6 h-6 rounded-lg border border-white/15 hover:scale-110 transition-all"
                      style={{ backgroundColor: c }} onClick={() => commitColor(c)}/>
                  ))}
                </div>
              </div>
              {/* Color harmony — complementary + triadic */}
              {(() => {
                const hex2hsl = (hex: string): [number,number,number] => {
                  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
                  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
                  if (max===min) return [0,0,l];
                  const d=max-min, s=l>0.5?d/(2-max-min):d/(max+min);
                  let h=0; if(max===r) h=(g-b)/d+(g<b?6:0); else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4; h/=6;
                  return [h,s,l];
                };
                const hsl2hex = (h: number, s: number, l: number): string => {
                  const hue2rgb = (p: number, q: number, t: number) => { let tt=t<0?t+1:t>1?t-1:t; return tt<1/6?p+(q-p)*6*tt:tt<1/2?q:tt<2/3?p+(q-p)*(2/3-tt)*6:p; };
                  const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
                  return '#' + [hue2rgb(p,q,h+1/3), hue2rgb(p,q,h), hue2rgb(p,q,h-1/3)].map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('');
                };
                const [h,s,l] = hex2hsl(color);
                const harmonyColors = [
                  { label: "Comp", c: hsl2hex((h+0.5)%1, s, l) },
                  { label: "Tri1", c: hsl2hex((h+1/3)%1, s, l) },
                  { label: "Tri2", c: hsl2hex((h+2/3)%1, s, l) },
                  { label: "Ana1", c: hsl2hex((h+1/12)%1, s, l) },
                  { label: "Ana2", c: hsl2hex((h-1/12+1)%1, s, l) },
                  { label: "Split1", c: hsl2hex((h+5/12)%1, s, l) },
                ];
                return (
                  <div className="mt-2 pt-2 border-t border-white/[0.06]">
                    <span className="text-[9px] text-white/20 uppercase tracking-wider font-bold block mb-1.5">Harmony</span>
                    <div className="flex gap-1 flex-wrap">
                      {harmonyColors.map(({ label, c }) => (
                        <button key={label} title={label}
                          className="w-5 h-5 rounded border border-white/15 hover:scale-110 transition-all"
                          style={{ backgroundColor: c }} onClick={() => commitColor(c)}/>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Brush Settings Panel ── */}
        {showBrushPanel && (
          <div className="absolute left-14 top-2 z-40 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl w-56 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Brush</span>
              <button className="text-white/20 hover:text-white" onClick={() => setShowBrushPanel(false)}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            {[
              { label: "Size", value: size, min: 1, max: 100, set: setSize, unit: "px" },
              { label: "Opacity", value: opacity, min: 1, max: 100, set: setOpacity, unit: "%" },
              { label: "Hardness", value: hardness, min: 0, max: 100, set: setHardness, unit: "%" },
              { label: "Flow", value: flow, min: 1, max: 100, set: setFlow, unit: "%" },
              { label: "Stabilizer", value: brushStabilizer, min: 0, max: 9, set: setBrushStabilizer, unit: "" },
            ].map(({ label, value, min, max, set, unit }) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-[11px] text-white/35 mb-1">
                  <span>{label}</span><span>{value}{unit}</span>
                </div>
                <Slider value={[value]} min={min} max={max} step={1}
                  onValueChange={([v]) => set(v!)}
                  className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
              </div>
            ))}
            {/* Brush Presets */}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <span className="text-[10px] text-white/25 uppercase tracking-wider font-bold block mb-2">Quick Presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Inking",     tool: "pen"        as Tool, size: 4,  opacity: 100, hardness: 100, flow: 100, stabilizer: 4 },
                  { label: "Sketch",     tool: "pencil"     as Tool, size: 6,  opacity: 80,  hardness: 60,  flow: 85,  stabilizer: 2 },
                  { label: "Brush",      tool: "brush"      as Tool, size: 14, opacity: 70,  hardness: 40,  flow: 80,  stabilizer: 3 },
                  { label: "Marker",     tool: "marker"     as Tool, size: 20, opacity: 85,  hardness: 100, flow: 100, stabilizer: 1 },
                  { label: "Watercolor", tool: "watercolor" as Tool, size: 18, opacity: 55,  hardness: 20,  flow: 60,  stabilizer: 3 },
                  { label: "Calligraphy",tool: "calligraphy"as Tool, size: 12, opacity: 90,  hardness: 80,  flow: 90,  stabilizer: 2 },
                  { label: "Spray",      tool: "spray"      as Tool, size: 25, opacity: 65,  hardness: 30,  flow: 70,  stabilizer: 0 },
                  { label: "Chalk",      tool: "chalk"      as Tool, size: 16, opacity: 70,  hardness: 50,  flow: 75,  stabilizer: 1 },
                ].map(p => (
                  <button key={p.label}
                    onClick={() => { setTool(p.tool); setSize(p.size); setOpacity(p.opacity); setHardness(p.hardness); setFlow(p.flow); setBrushStabilizer(p.stabilizer); }}
                    className={cn("py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all border",
                      tool === p.tool
                        ? "border-violet-500/50 bg-violet-600/15 text-violet-300"
                        : "border-white/[0.07] text-white/40 hover:border-white/15 hover:text-white/70")}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Gradient type toggle */}
            {tool === "gradient" && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[11px] text-white/35">Gradient type</span>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  {(["linear","radial"] as const).map(t => (
                    <button key={t} onClick={() => setGradientType(t)}
                      className={cn("px-2 py-1 text-[10px] capitalize transition-all",
                        gradientType === t ? "bg-violet-600 text-white" : "bg-white/5 text-white/40 hover:bg-white/10")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Filled shape toggle */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] text-white/35">Filled shapes</span>
              <button className={cn("w-10 h-5 rounded-full transition-all relative",
                filledShape ? "bg-violet-600" : "bg-white/10")}
                onClick={() => setFilledShape(p => !p)}>
                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  filledShape ? "left-5" : "left-0.5")}/>
              </button>
            </div>
            {/* Speed-based pressure */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-white/35">Speed pressure</span>
              <button className={cn("w-10 h-5 rounded-full transition-all relative",
                speedPressure ? "bg-violet-600" : "bg-white/10")}
                onClick={() => setSpeedPressure(p => !p)}>
                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  speedPressure ? "left-5" : "left-0.5")}/>
              </button>
            </div>
            {/* Snap to grid */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-white/35">Snap to grid</span>
              <button className={cn("w-10 h-5 rounded-full transition-all relative",
                snapToGrid ? "bg-violet-600" : "bg-white/10")}
                onClick={() => setSnapToGrid(p => !p)}>
                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  snapToGrid ? "left-5" : "left-0.5")}/>
              </button>
            </div>
            {/* Canvas background pattern */}
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] text-white/35 block mb-1.5">Canvas pattern</span>
              <div className="flex gap-1 flex-wrap">
                {(["none","checkerboard","dots","lines"] as const).map(p => (
                  <button key={p} onClick={() => setBgPattern(p)}
                    className={cn("px-2 py-0.5 text-[9px] capitalize rounded border transition-all",
                      bgPattern === p ? "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10")}>
                    {p === "none" ? "off" : p}
                  </button>
                ))}
              </div>
            </div>
            {/* Polygon sides */}
            {(tool === "polygon" || tool === "star") && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-white/35 mb-1">
                  <span>{tool === "star" ? "Star Points" : "Sides"}</span><span>{polygonSides}</span>
                </div>
                <Slider value={[polygonSides]} min={3} max={12} step={1}
                  onValueChange={([v]) => setPolygonSides(v!)}
                  className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
              </div>
            )}
            {/* Text font options */}
            {tool === "text" && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-white/25 uppercase tracking-wider font-bold block mb-2">Text Style</span>
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => setTextBold(b => !b)}
                    className={cn("flex-1 h-7 rounded-lg text-[12px] font-bold transition-all border",
                      textBold ? "border-violet-500/50 bg-violet-600/15 text-violet-300" : "border-white/[0.07] text-white/40 hover:border-white/15")}>B</button>
                  <button onClick={() => setTextItalic(i => !i)}
                    className={cn("flex-1 h-7 rounded-lg text-[12px] italic transition-all border",
                      textItalic ? "border-violet-500/50 bg-violet-600/15 text-violet-300" : "border-white/[0.07] text-white/40 hover:border-white/15")}>I</button>
                </div>
                <select value={textFont} onChange={e => setTextFont(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-white/60 px-2 py-1.5 outline-none">
                  {[
                    ["Inter, sans-serif", "Inter (default)"],
                    ["Georgia, serif", "Georgia"],
                    ["'Courier New', monospace", "Courier New"],
                    ["Arial, sans-serif", "Arial"],
                    ["'Times New Roman', serif", "Times New Roman"],
                    ["Impact, fantasy", "Impact"],
                    ["'Comic Sans MS', cursive", "Comic Sans"],
                  ].map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Grid size */}
            {showGrid && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-white/35 mb-1">
                  <span>Grid Size</span><span>{gridSize}px</span>
                </div>
                <Slider value={[gridSize]} min={10} max={200} step={10}
                  onValueChange={([v]) => setGridSize(v!)}
                  className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
              </div>
            )}
          </div>
        )}

        {/* ── Reference Image Panel ── */}
        {showRefPanel && (
          <div className="absolute left-14 top-2 z-40 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl w-60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Reference Image</span>
              <button className="text-white/20 hover:text-white" onClick={() => setShowRefPanel(false)}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            {refImage ? (
              <>
                <div className="relative rounded-xl overflow-hidden border border-white/10 mb-3" style={{ height: 100 }}>
                  <img src={refImage} alt="ref" className="w-full h-full object-contain bg-black/30"/>
                  <button
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/60 hover:text-white flex items-center justify-center"
                    onClick={() => { setRefImage(null); setShowRefPanel(false); }}>
                    <X className="w-3 h-3"/>
                  </button>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] text-white/35 mb-1.5">
                    <span>Opacity</span><span>{refOpacity}%</span>
                  </div>
                  <Slider value={[refOpacity]} min={5} max={95} step={5}
                    onValueChange={([v]) => setRefOpacity(v!)}
                    className="[&_[role=slider]]:bg-fuchsia-500 [&_[role=slider]]:border-0"/>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-white/35">Show overlay</span>
                  <button className={cn("w-10 h-5 rounded-full transition-all relative", showRefImage ? "bg-fuchsia-600" : "bg-white/10")}
                    onClick={() => setShowRefImage(p => !p)}>
                    <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", showRefImage ? "left-5" : "left-0.5")}/>
                  </button>
                </div>
                <button onClick={() => refInputRef.current?.click()}
                  className="w-full py-1.5 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg transition-colors">
                  Change Image
                </button>
              </>
            ) : (
              <button onClick={() => refInputRef.current?.click()}
                className="w-full py-6 flex flex-col items-center gap-2 text-white/30 hover:text-white/60 border-2 border-dashed border-white/10 hover:border-fuchsia-500/40 rounded-xl transition-all">
                <ImagePlus className="w-6 h-6"/>
                <span className="text-xs">Import photo to trace over</span>
              </button>
            )}
          </div>
        )}

        {/* ── Audio Bar ── */}
        {showAudioBar && (
          <div className="absolute left-14 top-2 z-40 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl w-60 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Audio Track</span>
              <button className="text-white/20 hover:text-white" onClick={() => setShowAudioBar(false)}>
                <X className="w-4 h-4"/>
              </button>
            </div>
            {audioURL ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl mb-3">
                  <Music2 className="w-4 h-4 text-fuchsia-400 shrink-0"/>
                  <span className="text-xs text-white/60 flex-1">Audio recorded</span>
                </div>
                <audio ref={audioElemRef} src={audioURL} className="w-full mb-3" controls
                  style={{ filter: "invert(1) hue-rotate(200deg) saturate(0.6)", height: 32 }}/>
                <div className="flex gap-2">
                  <button onClick={() => isRecording ? stopRecording() : void startRecording()}
                    className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5",
                      isRecording ? "bg-red-600/30 text-red-300 hover:bg-red-600/40" : "bg-white/5 text-white/50 hover:bg-white/8 hover:text-white border border-white/10")}>
                    {isRecording ? <><StopCircle className="w-3 h-3"/> Stop</> : <><Mic className="w-3 h-3"/> Re-record</>}
                  </button>
                  <button onClick={() => void clearAudio()}
                    className="px-3 py-2 text-xs text-red-400/60 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3 h-3"/>
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => isRecording ? stopRecording() : void startRecording()}
                className={cn("w-full py-5 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed transition-all",
                  isRecording
                    ? "border-red-500/60 bg-red-500/10 text-red-300 animate-pulse"
                    : "border-white/10 hover:border-fuchsia-500/40 text-white/30 hover:text-white/60")}>
                {isRecording ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
                <span className="text-xs">{isRecording ? "Recording… tap to stop" : "Record audio track"}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Shortcuts Modal ── */}
        {/* Canvas Resize Dialog */}
        {showResizeDialog && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowResizeDialog(false)}>
            <div className="bg-[#13131f] border border-white/10 rounded-2xl p-5 w-64 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-white/70">Resize Canvas</span>
                <button onClick={() => setShowResizeDialog(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4"/></button>
              </div>
              <p className="text-[11px] text-white/30 mb-3">Current: {project?.width ?? 800} × {project?.height ?? 600}px</p>
              <div className="space-y-3 mb-4">
                {[["Width", resizeW, setResizeW], ["Height", resizeH, setResizeH]].map(([label, val, setter]) => (
                  <div key={label as string}>
                    <label className="text-[11px] text-white/40 block mb-1">{label as string} (px)</label>
                    <input type="number" min={64} max={4096} value={val as number}
                      onChange={e => (setter as (v: number) => void)(Number(e.target.value))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-violet-500/50"/>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {[
                  ["640×480", 640, 480], ["800×600", 800, 600], ["1080×1080", 1080, 1080],
                  ["1920×1080", 1920, 1080], ["1080×1920", 1080, 1920],
                ].map(([label, w, h]) => (
                  <button key={label as string} onClick={() => { setResizeW(w as number); setResizeH(h as number); }}
                    className="text-[9px] text-white/40 hover:text-violet-300 bg-white/[0.04] hover:bg-violet-600/15 rounded-lg px-1.5 py-1 transition-all border border-white/[0.06]">
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => void applyCanvasResize()}
                className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 transition-all">
                Apply Resize
              </button>
            </div>
          </div>
        )}

        {showShortcuts && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
            <div className="bg-[#13131f] border border-white/10 rounded-2xl p-5 w-72 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white/70">Keyboard Shortcuts</span>
                <button onClick={() => setShowShortcuts(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4"/></button>
              </div>
              <div className="space-y-1">
                {ALL_TOOLS.map(t => (
                  <div key={t.id} className="flex justify-between text-[12px]">
                    <span className="text-white/50">{t.label}</span>
                    <kbd className="bg-white/8 px-1.5 py-0.5 rounded text-white/60 font-mono">{t.shortcut}</kbd>
                  </div>
                ))}
                <div className="h-px bg-white/8 my-2"/>
                {[["Undo","Ctrl+Z"],["Redo","Ctrl+Y or Ctrl+Shift+Z"],["Copy Layer","Ctrl+C"],["Paste Layer","Ctrl+V"],["Prev Frame","["],["Next Frame","]"],["Play/Pause","Space"],["Stop","Escape"]].map(([label, key]) => (
                  <div key={label} className="flex justify-between text-[12px]">
                    <span className="text-white/50">{label}</span>
                    <kbd className="bg-white/8 px-1.5 py-0.5 rounded text-white/60 font-mono text-[10px]">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Canvas Area ── */}
        <div className="flex-1 relative overflow-hidden bg-[#030308] flex items-center justify-center"
          onClick={() => { setShowColorPanel(false); }}
          onWheel={handleWheel}>
          {/* Fine grid bg to visually distinguish from canvas */}
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}/>
          {/* Canvas background pattern overlay (user-selected) */}
          {bgPattern !== "none" && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: bgPattern === "checkerboard"
                ? "linear-gradient(45deg,rgba(255,255,255,0.04) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,0.04) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,0.04) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,0.04) 75%)"
                : bgPattern === "dots"
                  ? "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)"
                  : "repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0px,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 24px)",
              backgroundSize: bgPattern === "checkerboard" ? "32px 32px" : bgPattern === "dots" ? "20px 20px" : "24px 24px",
              backgroundPosition: bgPattern === "checkerboard" ? "0 0, 0 16px, 16px -16px, -16px 0" : "0 0",
              mixBlendMode: "overlay",
            }}/>
          )}

          <div style={{
            transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: "center",
            transition: "none",
          }} className="relative shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_48px_rgba(0,0,0,0.95)]">
            {/* Main canvas */}
            <canvas ref={canvasRef} width={CW} height={CH}
              className="block"
              style={{ width: canvasDisplayW, height: "auto" }}
            />
            {/* Reference image — semi-transparent overlay for tracing */}
            {refImage && showRefImage && (
              <img
                src={refImage}
                alt="reference"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                style={{ opacity: refOpacity / 100 }}
              />
            )}
            {/* Overlay canvas (shape preview + cursor) */}
            <canvas ref={overlayRef} width={CW} height={CH}
              className="absolute inset-0 pointer-events-none"
              style={{ width: canvasDisplayW, height: "auto" }}
            />
            {/* Visual brush cursor overlay */}
            {cursorPos && !isPlaying && tool !== "move" && tool !== "text" && tool !== "eyedropper" && (
              <div className="absolute pointer-events-none" style={{
                left: cursorPos.x - size / 2,
                top: cursorPos.y - size / 2,
                width: size, height: size,
                borderRadius: "50%",
                border: `1.5px solid ${tool === "eraser" ? "rgba(255,100,100,0.7)" : color}`,
                boxShadow: `0 0 0 1px rgba(0,0,0,0.4)`,
                opacity: 0.85,
                zIndex: 10,
              }}/>
            )}
            {/* Event canvas on top */}
            <canvas width={CW} height={CH}
              className="absolute inset-0 block"
              style={{
                width: canvasDisplayW, height: "auto",
                cursor: tool === "move" ? "grab" : tool === "text" ? "text" : tool === "eyedropper" ? "crosshair" : "none",
                touchAction: "none",
                opacity: 0,
              }}
              onMouseMove={e => {
                const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                const scale = CW / rect.width;
                setCursorPos({ x: (e.clientX - rect.left) / scale * (rect.width / CW) * scale / scale, y: (e.clientY - rect.top) / scale * (rect.height / CH) * scale / scale });
              }}
              onMouseLeave={() => setCursorPos(null)}
              onMouseDown={startDraw} onMouseMove={continueDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={continueDraw} onTouchEnd={endDraw}
            />
            {/* Text input */}
            {textInput && (
              <input autoFocus
                className="absolute bg-transparent border-b border-violet-500 outline-none text-white"
                style={{
                  left: `${textInput.x * 100}%`,
                  top: `${textInput.y * 100}%`,
                  fontSize: `${size * 3}px`,
                  color,
                  fontFamily: textFont,
                  fontWeight: textBold ? "bold" : "normal",
                  fontStyle: textItalic ? "italic" : "normal",
                  minWidth: 80,
                  transform: `translateY(-50%)`,
                }}
                value={textInput.val}
                onChange={e => setTextInput(prev => prev ? { ...prev, val: e.target.value } : null)}
                onKeyDown={e => {
                  if (e.key === "Enter") commitText(textInput.val);
                  if (e.key === "Escape") setTextInput(null);
                }}
                onBlur={() => commitText(textInput.val)}
              />
            )}
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-0.5 bg-[#0e0e1a]/90 backdrop-blur-sm rounded-xl px-1 py-1 border border-white/[0.05]">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
              onClick={() => setZoom(z => Math.max(0.05, z * 0.8))}><ZoomOut className="w-3.5 h-3.5"/></button>
            <button className="text-[11px] text-white/40 w-12 text-center hover:text-white"
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
              onClick={() => setZoom(z => Math.min(16, z * 1.25))}><ZoomIn className="w-3.5 h-3.5"/></button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-3.5 h-3.5"/>
            </button>
          </div>

          {/* Layer indicator */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/[0.08]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentLayer?.locked ? "#f59e0b" : "#8b5cf6" }}/>
            <span className="text-[11px] text-white/70 font-medium">{currentLayer?.name ?? "No Layer"}</span>
            {currentLayer?.locked && <Lock className="w-2.5 h-2.5 text-amber-400"/>}
            {selectionRect && <Scissors className="w-2.5 h-2.5 text-blue-400"/>}
          </div>

          {/* Canvas draw hint — shows briefly when canvas is totally empty */}
          {layers.every(l => (layerStrokes.current.get(l.id) ?? []).length === 0) && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 opacity-30">
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/40 flex items-center justify-center">
                  <span className="text-2xl">✏️</span>
                </div>
                <span className="text-xs text-white font-medium">Start drawing here</span>
              </div>
            </div>
          )}

          {/* Onion skin controls (floating) */}
          <div className="absolute top-2 right-3 flex items-center gap-1 bg-[#0e0e1a]/80 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/[0.05]">
            <button className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors",
              showOnionSkin ? "text-amber-300 bg-amber-500/20" : "text-white/25 hover:text-white")}
              onClick={() => setShowOnionSkin(p => !p)}>
              ONION {showOnionSkin ? "ON" : "OFF"}
            </button>
            {showOnionSkin && <>
              {/* Prev colour swatch */}
              <label className="relative cursor-pointer" title="Previous frame ghost colour">
                <div className="w-3 h-3 rounded-sm border border-white/20" style={{ background: onionPrevColor }}/>
                <input type="color" value={onionPrevColor} onChange={e => setOnionPrevColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              </label>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionPrev(p => Math.max(0, p - 1))}>
                ←{onionPrev}
              </button>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionPrev(p => Math.min(5, p + 1))}>+</button>
              <span className="text-[10px] text-white/20">|</span>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionNext(p => Math.max(0, p - 1))}>
                {onionNext}→
              </button>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionNext(p => Math.min(5, p + 1))}>+</button>
              {/* Next colour swatch */}
              <label className="relative cursor-pointer" title="Next frame ghost colour">
                <div className="w-3 h-3 rounded-sm border border-white/20" style={{ background: onionNextColor }}/>
                <input type="color" value={onionNextColor} onChange={e => setOnionNextColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
              </label>
            </>}
          </div>
        </div>

        {/* ── Layers Panel ── */}
        {showLayersPanel && (
          <div className="w-56 bg-[#0b0b18] border-l border-white/[0.06] flex flex-col shrink-0 overflow-hidden">
            <div className="h-10 border-b border-white/[0.05] flex items-center px-3 justify-between shrink-0">
              <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Layers</span>
              <div className="flex gap-0.5">
                <button className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10" onClick={addLayer}>
                  <Plus className="w-3 h-3"/>
                </button>
                <button className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10" onClick={() => setShowLayersPanel(false)}>
                  <X className="w-3 h-3"/>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {sortedLayers.map((layer, ridx) => (
                <div key={layer.id}
                  className={cn("rounded-xl border p-2 cursor-pointer transition-all",
                    currentLayerId === layer.id ? "border-violet-500/40 bg-violet-600/10" : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.02]")}
                  onClick={() => setCurrentLayerId(layer.id)}>

                  {showRenameLayer === layer.id ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => { void renameLayer(layer.id, renameValue); setShowRenameLayer(null); }}
                        onKeyDown={e => {
                          if (e.key === "Enter") { void renameLayer(layer.id, renameValue); setShowRenameLayer(null); }
                          if (e.key === "Escape") setShowRenameLayer(null);
                        }}
                        className="flex-1 bg-white/8 border border-violet-500/30 rounded text-[11px] text-white px-1 py-0.5 outline-none w-full"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-7 rounded-md bg-white/[0.04] border border-white/[0.06] shrink-0 flex items-center justify-center">
                        {(layerStrokes.current.get(layer.id) ?? []).length > 0
                          ? <span className="text-[8px] text-violet-400 font-bold">✓</span>
                          : <span className="text-[8px] text-white/10">—</span>}
                      </div>
                      <span className="flex-1 text-[11px] font-medium text-white/60 truncate">{layer.name}</span>
                      {/* Actions */}
                      <button className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors",
                        layer.visible ? "text-white/35 hover:text-white" : "text-white/10")}
                        onClick={e => { e.stopPropagation(); void toggleVis(layer.id); }}>
                        {layer.visible ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                      </button>
                      <button className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0",
                        layer.locked ? "text-amber-400" : "text-white/20")}
                        onClick={e => { e.stopPropagation(); void toggleLock(layer.id); }}>
                        {layer.locked ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3"/>}
                      </button>
                    </div>
                  )}

                  {currentLayerId === layer.id && showRenameLayer !== layer.id && (
                    <div className="mt-2 space-y-1.5">
                      {/* Opacity */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 w-5">Op</span>
                        <Slider value={[layer.opacity]} min={0} max={100} step={1}
                          onValueChange={([v]) => void changeOpacity(layer.id, v!)}
                          className="flex-1 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"/>
                        <span className="text-[9px] text-white/20 w-6 text-right">{layer.opacity}%</span>
                      </div>
                      {/* Blend mode */}
                      <select value={layer.blendMode}
                        onChange={e => void changeBlendMode(layer.id, e.target.value)}
                        className="w-full bg-white/[0.06] border border-white/10 rounded text-[10px] text-white/50 px-1.5 py-0.5 outline-none">
                        {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {/* Layer adjust (brightness/contrast/saturation) */}
                      {showLayerAdjust === layer.id ? (
                        <div className="space-y-1 mt-1 p-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                          {[
                            { label: "Bright", val: layerBright, set: setLayerBright },
                            { label: "Contrast", val: layerContrast, set: setLayerContrast },
                            { label: "Sat", val: layerSat, set: setLayerSat },
                          ].map(({ label, val, set }) => (
                            <div key={label} className="flex items-center gap-1">
                              <span className="text-[8px] text-white/25 w-9 shrink-0">{label}</span>
                              <input type="range" min={-100} max={100} value={val}
                                onChange={e => set(Number(e.target.value))}
                                className="flex-1 h-1 accent-violet-500"/>
                              <span className="text-[8px] text-white/25 w-6 text-right tabular-nums">{val > 0 ? "+" : ""}{val}</span>
                            </div>
                          ))}
                          <div className="flex gap-1 mt-1">
                            <button className="flex-1 h-5 rounded text-[8px] bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                              onClick={() => applyLayerAdjust(layer.id)}>Apply</button>
                            <button className="flex-1 h-5 rounded text-[8px] text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                              onClick={() => { setShowLayerAdjust(null); setLayerBright(0); setLayerContrast(0); setLayerSat(0); }}>Cancel</button>
                          </div>
                        </div>
                      ) : null}
                      {/* Layer actions */}
                      <div className="flex gap-0.5">
                        <button className="flex-1 h-6 rounded text-[9px] text-white/30 hover:text-white hover:bg-white/10 flex items-center justify-center gap-0.5"
                          onClick={() => { setShowRenameLayer(layer.id); setRenameValue(layer.name); }}>
                          <Edit3 className="w-2.5 h-2.5"/> Rename
                        </button>
                        <button className="flex-1 h-6 rounded text-[9px] text-violet-400/60 hover:text-violet-300 hover:bg-violet-500/10 flex items-center justify-center gap-0.5"
                          onClick={() => { setShowLayerAdjust(showLayerAdjust === layer.id ? null : layer.id); setLayerBright(0); setLayerContrast(0); setLayerSat(0); }}>
                          <Sliders className="w-2.5 h-2.5"/> Adj
                        </button>
                        <button className="flex-1 h-6 rounded text-[9px] text-white/30 hover:text-white hover:bg-white/10 flex items-center justify-center gap-0.5"
                          onClick={() => void duplicateLayer(layer.id)}>
                          <Copy className="w-2.5 h-2.5"/> Dup
                        </button>
                        <button className="h-6 rounded text-[9px] text-white/30 hover:text-white hover:bg-white/10 px-1"
                          onClick={() => void moveLayerUp(ridx)}><ChevronUp className="w-3 h-3"/></button>
                        <button className="h-6 rounded text-[9px] text-white/30 hover:text-white hover:bg-white/10 px-1"
                          onClick={() => void moveLayerDown(ridx)}><ChevronDown className="w-3 h-3"/></button>
                        {layers.length > 1 && (
                          <button className="h-6 w-6 rounded text-[9px] text-red-400/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
                            onClick={e => { e.stopPropagation(); void deleteLayer(layer.id); }}>
                            <Trash2 className="w-3 h-3"/>
                          </button>
                        )}
                      </div>
                      {/* Quick pixel effects row */}
                      <div className="flex gap-0.5 flex-wrap">
                        {(["grayscale","sepia","invert","posterize","pixelate"] as const).map(fx => (
                          <button key={fx}
                            className="h-5 px-1.5 rounded text-[7px] text-white/25 hover:text-white hover:bg-white/10 transition-colors border border-white/[0.04] hover:border-white/15 capitalize"
                            onClick={() => applyPixelEffect(layer.id, fx)}
                            title={`Apply ${fx} effect (destructive)`}>
                            {fx === "grayscale" ? "Gray" : fx === "posterize" ? "Post" : fx === "pixelate" ? "Pxl" : fx[0]!.toUpperCase()+fx.slice(1)}
                          </button>
                        ))}
                      </div>
                      {/* Merge down */}
                      {ridx < sortedLayers.length - 1 && (
                        <button className="w-full h-5 rounded text-[9px] text-white/20 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1"
                          onClick={() => void mergeDownLayer(layer.id)}>
                          <ChevronDown className="w-2.5 h-2.5"/> Merge Down
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {layers.filter(l => l.visible).length >= 2 && (
                <button className="w-full h-6 mt-1 rounded-lg text-[9px] text-white/30 hover:text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-1 border border-transparent hover:border-amber-500/20 transition-all"
                  onClick={() => void mergeAllVisibleLayers()}>
                  <Layers className="w-2.5 h-2.5"/> Merge All Visible
                </button>
              )}
              {layers.length === 0 && (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Layers className="w-5 h-5 text-white/15"/>
                  <p className="text-[10px] text-white/20">No layers</p>
                  <button className="text-[10px] text-violet-400 hover:text-violet-300" onClick={addLayer}>+ Add Layer</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      <div className="bg-[#0b0b18] border-t border-white/[0.06] shrink-0">
        {/* Playback controls */}
        <div className="h-9 flex items-center px-3 gap-2 border-b border-white/[0.04]">
          <button onClick={() => void switchFrame(0)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
            <SkipBack className="w-3.5 h-3.5"/>
          </button>
          <button onClick={() => void switchFrame(currentFrameIdx - 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
            <ChevronLeft className="w-3.5 h-3.5"/>
          </button>
          <button onClick={() => { pingPongDir.current = 1; setIsPlaying(p => !p); }}
            className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isPlaying ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "bg-white/10 text-white hover:bg-white/15")}>
            {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
          </button>
          <button onClick={() => void switchFrame(currentFrameIdx + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
            <ChevronRight className="w-3.5 h-3.5"/>
          </button>
          <button onClick={() => void switchFrame(frames.length - 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
            <SkipForward className="w-3.5 h-3.5"/>
          </button>

          <div className="w-px h-5 bg-white/[0.07]"/>

          <span className="text-[11px] text-white/25 tabular-nums">
            {currentFrameIdx + 1} / {frames.length}
          </span>

          <div className="flex-1"/>

          {/* FPS control */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/25">FPS</span>
            <select value={project.fps}
              onChange={async e => {
                const fps = Number(e.target.value);
                await db.projects.update(projectId, { fps });
                setProject(p => p ? { ...p, fps } : p);
              }}
              className="bg-white/[0.06] border border-white/10 rounded text-[10px] text-white/50 px-1.5 py-0.5 outline-none">
              {[1,2,4,6,8,10,12,15,18,24,25,30,60].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors",
            loopPlay ? "border-violet-500/35 text-violet-400" : "border-white/[0.07] text-white/20")}
            onClick={() => setLoopPlay(p => !p)}>
            <Repeat className="w-2.5 h-2.5"/> Loop
          </button>

          <button className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors",
            pingPong ? "border-fuchsia-500/35 text-fuchsia-400" : "border-white/[0.07] text-white/20")}
            onClick={() => setPingPong(p => !p)}>
            <Repeat2 className="w-2.5 h-2.5"/> Ping
          </button>

          {/* Speed control */}
          <button
            onClick={() => setPlaybackSpeed(s => {
              const opts = [0.25, 0.5, 1, 2, 4];
              const idx = opts.indexOf(s);
              return opts[(idx + 1) % opts.length]!;
            })}
            className={cn(
              "text-[10px] px-2 py-1 rounded-full border transition-colors font-mono tabular-nums",
              playbackSpeed !== 1 ? "border-cyan-500/35 text-cyan-400" : "border-white/[0.07] text-white/20"
            )}
            title="Playback speed">
            {playbackSpeed}×
          </button>

          <button className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-violet-500/35 text-violet-400 hover:bg-violet-600/10 transition-colors"
            onClick={() => void addFrame()}>
            <Plus className="w-2.5 h-2.5"/> Frame
          </button>

          <button className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-white/[0.07] text-white/20 hover:text-white hover:border-white/20 transition-colors"
            onClick={() => setShowTimelineTools(p => !p)}>
            <Settings2 className="w-2.5 h-2.5"/>
          </button>
        </div>

        {/* Extra timeline tools */}
        {showTimelineTools && (
          <div className="flex flex-wrap items-center px-3 py-1.5 gap-1.5 border-b border-white/[0.04] bg-[#0a0a15]">
            <span className="text-[10px] text-white/25 shrink-0">Add frames:</span>
            {[3,5,10].map(n => (
              <button key={n} className="text-[10px] text-white/35 hover:text-white px-2 py-1 rounded-lg border border-white/[0.07] hover:border-white/20 transition-colors"
                onClick={() => void addMultipleFrames(n)}>
                +{n}
              </button>
            ))}
            <div className="w-px h-5 bg-white/[0.07] mx-1"/>
            {/* Copy artwork to next frame — key animation feature */}
            <button
              className="text-[10px] text-fuchsia-400/70 hover:text-fuchsia-300 px-2 py-1 rounded-lg border border-fuchsia-500/20 hover:border-fuchsia-500/50 transition-colors flex items-center gap-1"
              onClick={() => void copyArtworkToNextFrame()}
              title="Copies current frame's drawing to the next frame">
              Copy → Next
            </button>
            <button className="text-[10px] text-white/35 hover:text-violet-400 px-2 py-1 rounded-lg border border-white/[0.07] hover:border-violet-500/30 transition-colors"
              onClick={() => { void invert(); }}>
              Invert
            </button>
            <button className="text-[10px] text-white/30 hover:text-red-400 px-2 py-1 rounded-lg border border-white/[0.07] hover:border-red-500/30 transition-colors"
              onClick={() => { if (confirm("Delete all frames except current?")) {
                frames.forEach((_, i) => { if (i !== currentFrameIdx) void deleteFrame(i); });
              }}}>
              Keep only current
            </button>
            <div className="w-px h-5 bg-white/[0.07] mx-1"/>
            {/* Frame hold — repeat current frame N times in export/playback */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-white/25">Hold:</span>
              <button className="text-[10px] text-white/30 hover:text-white px-1"
                onClick={() => void updateFrameHold(currentFrameIdx, (frames[currentFrameIdx]?.hold ?? 1) - 1)}>−</button>
              <span className="text-[10px] text-cyan-400/70 tabular-nums w-4 text-center">{frames[currentFrameIdx]?.hold ?? 1}</span>
              <button className="text-[10px] text-white/30 hover:text-white px-1"
                onClick={() => void updateFrameHold(currentFrameIdx, (frames[currentFrameIdx]?.hold ?? 1) + 1)}>+</button>
            </div>
            {/* Copy layer to another frame */}
            {frames.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/25">Copy layer →</span>
                <select className="bg-white/[0.06] border border-white/10 rounded text-[10px] text-white/50 px-1 py-0.5 outline-none"
                  defaultValue=""
                  onChange={e => { const idx = Number(e.target.value); if (!isNaN(idx) && idx !== currentFrameIdx) void copyLayerToFrame(idx); (e.target as HTMLSelectElement).value = ""; }}>
                  <option value="" disabled>frame…</option>
                  {frames.map((_, i) => i !== currentFrameIdx && (
                    <option key={i} value={i}>Frame {i + 1}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Frame strip */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 overflow-x-auto" style={{ height: 76 }}>
          {frames.map((frame, idx) => (
            <div key={frame.id}
              className={cn("relative shrink-0 w-14 rounded-xl border-2 cursor-pointer overflow-hidden transition-all group",
                currentFrameIdx === idx
                  ? "border-violet-500 ring-1 ring-violet-500/25 shadow-lg shadow-violet-900/20"
                  : "border-white/[0.07] hover:border-white/20")}
              style={{ height: 54 }}
              onClick={() => !isPlaying && void switchFrame(idx)}>
              {frame.thumbnail
                ? <img src={frame.thumbnail} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full bg-white/[0.02] flex items-center justify-center">
                    <span className="text-[10px] text-white/15">{idx + 1}</span>
                  </div>
              }
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                <button className="w-6 h-6 rounded flex items-center justify-center text-white hover:bg-white/20"
                  onClick={e => { e.stopPropagation(); void duplicateFrame(idx); }}>
                  <Copy className="w-2.5 h-2.5"/>
                </button>
                {frames.length > 1 && (
                  <button className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-500/20"
                    onClick={e => { e.stopPropagation(); void deleteFrame(idx); }}>
                    <Trash2 className="w-2.5 h-2.5"/>
                  </button>
                )}
              </div>
              {/* Per-frame delay badge — click to edit */}
              <div className="absolute bottom-0 left-0 right-0 h-4 flex items-center px-1 gap-0.5">
                <span className="text-[8px] text-white/25">{idx + 1}</span>
                {editingFrameDelay === idx ? (
                  <input autoFocus type="number" min={16} max={5000} step={10}
                    defaultValue={frame.duration && frame.duration > 0 ? frame.duration : Math.round(1000 / (project?.fps ?? 12))}
                    className="w-9 h-3 bg-black/80 border border-violet-500/60 rounded text-[7px] text-white px-0.5 outline-none"
                    onBlur={e => { void updateFrameDelay(idx, Number(e.target.value) || 83); setEditingFrameDelay(null); }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { void updateFrameDelay(idx, Number((e.target as HTMLInputElement).value) || 83); setEditingFrameDelay(null); } }}
                  />
                ) : (frame.duration && frame.duration > 0) ? (
                  <button className="text-[7px] text-violet-400 hover:text-violet-200 transition-colors"
                    onClick={e => { e.stopPropagation(); setEditingFrameDelay(idx); }}
                    title="Custom frame delay (ms)">
                    {frame.duration}ms
                  </button>
                ) : (
                  <button className="text-[7px] text-white/20 hover:text-white/50 transition-colors"
                    onClick={e => { e.stopPropagation(); setEditingFrameDelay(idx); }}
                    title="Click to set custom frame delay">⏱</button>
                )}
              </div>
              {currentFrameIdx === idx && <div className="absolute top-0 left-0 right-0 h-0.5 bg-violet-500"/>}
              {/* Frame label — double-click to rename */}
              {editingFrameLabel === idx ? (
                <div className="absolute -bottom-5 left-0 right-0 z-20">
                  <input autoFocus value={frameLabelVal}
                    onChange={e => setFrameLabelVal(e.target.value)}
                    onBlur={() => void updateFrameLabel(idx, frameLabelVal)}
                    onKeyDown={e => {
                      if (e.key === "Enter") void updateFrameLabel(idx, frameLabelVal);
                      if (e.key === "Escape") setEditingFrameLabel(null);
                    }}
                    className="w-full bg-[#1a1a2e] border border-violet-500/60 rounded text-[8px] text-white px-1 py-0.5 outline-none"
                    placeholder="Label…"/>
                </div>
              ) : frame.label ? (
                <div className="absolute -bottom-4 left-0 right-0 text-center">
                  <span className="text-[7px] text-violet-300/60 truncate cursor-pointer hover:text-violet-200"
                    onDoubleClick={e => { e.stopPropagation(); setFrameLabelVal(frame.label ?? ""); setEditingFrameLabel(idx); }}>
                    {frame.label}
                  </span>
                </div>
              ) : (
                <div className="absolute -bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[7px] text-white/20 cursor-pointer hover:text-white/50"
                    onDoubleClick={e => { e.stopPropagation(); setFrameLabelVal(""); setEditingFrameLabel(idx); }}>
                    label
                  </span>
                </div>
              )}
            </div>
          ))}
          {/* Add frame button in strip */}
          <button className="shrink-0 w-12 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/40 flex items-center justify-center text-white/20 hover:text-violet-400 transition-all"
            style={{ height: 54 }}
            onClick={() => void addFrame()}>
            <Plus className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* Hidden file input for reference image import */}
      <input
        ref={refInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={loadRefImage}
      />
      {/* Audio element for playback */}
      <audio ref={audioElemRef} src={audioURL ?? undefined} preload="auto"/>

      <Watermark/>
    </div>
  );
}
