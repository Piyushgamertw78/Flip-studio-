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
  Mic, MicOff, ImagePlus, Music2, StopCircle, Volume2, VolumeX,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorWheel } from "@/components/color-wheel";
import { Watermark } from "@/components/watermark";
import { cn } from "@/lib/utils";
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

const PRESET_COLORS = [
  "#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e",
  "#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f59e0b",
  "#6366f1","#14b8a6","#64748b","#a3a3a3","#7c3aed","#be185d",
  "#0284c7","#15803d","#b45309","#dc2626","#7c3aed","#0e7490",
];

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
  const [color, setColor]           = useState("#000000");
  const [size, setSize]             = useState(6);
  const [opacity, setOpacity]       = useState(100);
  const [hardness, setHardness]     = useState(80);
  const [flow, setFlow]             = useState(100);
  const [brushStabilizer, setBrushStabilizer] = useState(3);
  const [filledShape, setFilledShape] = useState(false);
  const [polygonSides, setPolygonSides] = useState(6);
  const [zoom, setZoom]             = useState(1);
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 });
  const [recentColors, setRecentColors] = useState<string[]>(["#000000","#ffffff","#ef4444","#3b82f6","#22c55e"]);

  // UI panels
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showColorPanel, setShowColorPanel]   = useState(false);
  const [showBrushPanel, setShowBrushPanel]   = useState(false);
  const [showTimelineTools, setShowTimelineTools] = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [showShortcuts, setShowShortcuts]     = useState(false);
  const [showRenameLayer, setShowRenameLayer] = useState<number | null>(null);
  const [renameValue, setRenameValue]         = useState("");
  const [showRenameProject, setShowRenameProject] = useState(false);
  const [projectNameVal, setProjectNameVal]   = useState("");

  // Animation
  const [isPlaying, setIsPlaying]   = useState(false);
  const [loopPlay, setLoopPlay]     = useState(true);
  const [pingPong, setPingPong]     = useState(false);
  const [showOnionSkin, setShowOnionSkin] = useState(true);
  const [onionPrev, setOnionPrev]   = useState(2);
  const [onionNext, setOnionNext]   = useState(1);
  const [showGrid, setShowGrid]     = useState(false);
  const [gridSize, setGridSize]     = useState(40);
  const [showRulers, setShowRulers] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>("none");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [textInput, setTextInput]   = useState<{ x: number; y: number; val: string } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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
  const playTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panStart   = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pingPongDir = useRef(1);

  // Touch gestures
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const touchPanStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const refInputRef       = useRef<HTMLInputElement>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const audioElemRef      = useRef<HTMLAudioElement | null>(null);

  const CW = project?.width ?? 1920;
  const CH = project?.height ?? 1080;

  // ─── Load project ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
        if (!proj) { setLoading(false); setLocation("/"); return; }
        setProject(proj);
        setFrames(fs);
        setProjectNameVal(proj.name);
        if (proj.audioTrack) setAudioURL(proj.audioTrack);
        if (fs.length > 0) {
          const ls = await db.layers.listByFrame(fs[0]!.id);
          setLayers(ls);
          const map = new Map<number, Stroke[]>();
          for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
          layerStrokes.current = map;
          setCurrentLayerId(ls[0]?.id ?? null);
        }
        setLoading(false);
      } catch {
        setLoading(false);
        setLocation("/");
      }
    };
    void load();
  }, [projectId]);

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

    // Onion skinning — previous frames
    if (showOnionSkin) {
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
        // Tint red for previous
        ctx.fillStyle = `rgba(255,80,80,${0.15 / i})`;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0);
        ctx.globalAlpha = 1;
      }

      // Forward frames
      for (let i = 1; i <= onionNext; i++) {
        const nf = frames[currentFrameIdx + i];
        if (!nf) continue;
        ctx.globalAlpha = 0.18 / i;
        // Tint green for next
        ctx.fillStyle = `rgba(80,255,80,${0.12 / i})`;
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
  }, [project, layers, frames, currentFrameIdx, showOnionSkin, onionPrev, onionNext, showGrid, gridSize, symmetryMode, showRulers, selectionRect, zoom]);

  useEffect(() => { redraw(); }, [redraw]);

  // ─── Playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      playTimer.current = setInterval(async () => {
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
          }
          return next;
        });
      }, 1000 / (project?.fps ?? 12));
    } else {
      if (playTimer.current) { clearInterval(playTimer.current); playTimer.current = null; }
    }
    return () => { if (playTimer.current) clearInterval(playTimer.current); };
  }, [isPlaying, frames, project?.fps, loopPlay, pingPong]);

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
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveCurrentLayerData(); }, 1200);
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
    }
  }, [isPlaying, tool, panOffset, getPos, currentLayerId, currentLayer, color, size, opacity, hardness, flow, symmetryMode, filledShape, polygonSides, commitColor, redraw, scheduleAutoSave]);

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

      // Apply stabilizer (lazy brush)
      for (let si = 0; si < allCurStrokes.current.length; si++) {
        const stroke = allCurStrokes.current[si]!;
        const sp = symmPoints[si] ?? pos;
        const lastPt = stroke.points[stroke.points.length - 1]!;
        const stab = Math.max(0, Math.min(9, brushStabilizer));
        const t = stab === 0 ? 1 : 1 / (stab + 1);
        const sx = lastPt.x + (sp.x - lastPt.x) * t;
        const sy = lastPt.y + (sp.y - lastPt.y) * t;
        const stabPt: Point = { x: sx, y: sy, pressure: sp.pressure };
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
  }, [tool, panOffset, getPos, currentLayerId, symmetryMode, brushStabilizer]);

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
    const stroke: Stroke = {
      tool: "text", color, size, opacity, points: [{ x: textInput.x, y: textInput.y, pressure: 1 }],
      text: val, textX: textInput.x, textY: textInput.y, textSize: size * 5,
    };
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    const existing = layerStrokes.current.get(currentLayerId) ?? [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, [...existing, stroke]);
    setTextInput(null);
    redraw(); scheduleAutoSave();
  }, [textInput, currentLayerId, currentLayer, color, size, opacity, redraw, scheduleAutoSave]);

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
      if (!e.ctrlKey && !e.metaKey && map[e.key.toLowerCase()]) {
        setTool(map[e.key.toLowerCase()]!);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copyLayer(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); pasteLayer(); }
      if (e.key === "[") setCurrentFrameIdx(i => Math.max(0, i - 1));
      if (e.key === "]") setCurrentFrameIdx(i => Math.min(frames.length - 1, i + 1));
      if (e.key === " " && !isPlaying) { e.preventDefault(); setIsPlaying(true); }
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
  }, [textInput, undo, redo, copyLayer, pasteLayer, frames.length, isPlaying, selectionRect, currentLayerId, currentLayer, redraw, scheduleAutoSave]);

  // ─── Export single frame ─────────────────────────────────────────────────────
  const exportCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `frame_${currentFrameIdx + 1}.png`;
    a.click();
  }, [currentFrameIdx]);

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
    <div className="h-screen w-screen flex items-center justify-center bg-[#080811]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 animate-pulse"/>
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"/>
        <p className="text-sm text-white/40">Loading FlipStudio…</p>
      </div>
    </div>
  );
  if (!project) return null;

  // Give canvas maximum space — subtract only actual UI widths (toolbar=48, layers=224)
  const canvasPx = { w: `min(calc(100vw - ${showLayersPanel ? 272 : 52}px), calc((100vh - 210px) * ${CW} / ${CH}))` };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#060610] text-white overflow-hidden select-none"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* ── Top Bar ── */}
      <div className="h-11 flex items-center px-2 gap-1 border-b border-white/[0.06] bg-[#0b0b18] shrink-0 z-20">
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
          onClick={async () => { await saveCurrentLayerData(); setLocation("/"); }}>
          <ArrowLeft className="w-4 h-4"/>
        </button>

        {showRenameProject ? (
          <div className="flex items-center gap-1">
            <input autoFocus value={projectNameVal} onChange={e => setProjectNameVal(e.target.value)}
              onBlur={saveProjectName} onKeyDown={e => { if (e.key === "Enter") void saveProjectName(); if (e.key === "Escape") setShowRenameProject(false); }}
              className="bg-white/8 border border-violet-500/30 rounded-lg text-sm font-semibold text-white px-2 py-1 outline-none w-40"/>
          </div>
        ) : (
          <button className="flex items-center gap-1 text-sm font-semibold text-white/70 hover:text-white transition-colors"
            onClick={() => setShowRenameProject(true)}>
            {project.name}
            <Edit3 className="w-3 h-3 text-white/25"/>
          </button>
        )}

        <div className="text-[10px] text-white/20 ml-1">{CW}×{CH} · {project.fps}fps</div>

        <div className="flex-1"/>

        {/* Symmetry */}
        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 mr-1">
          {SYMMETRY_OPTIONS.map(m => (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button className={cn("w-7 h-6 rounded text-[9px] font-bold transition-all",
                  symmetryMode === m ? "bg-violet-600 text-white" : "text-white/30 hover:text-white hover:bg-white/8")}
                  onClick={() => setSymmetryMode(m)}>
                  {m === "none" ? "OFF" : m === "horizontal" ? "H" : m === "vertical" ? "V" : m === "both" ? "HV" : m === "radial4" ? "4X" : "8X"}
                </button>
              </TooltipTrigger>
              <TooltipContent>{m === "none" ? "No Symmetry" : `${m} Symmetry`}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <button onClick={() => setShowGrid(s => !s)} title="Grid"
          className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            showGrid ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/8")}>
          <Grid3X3 className="w-4 h-4"/>
        </button>
        <button onClick={() => setShowRulers(s => !s)} title="Rulers"
          className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            showRulers ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/8")}>
          <Target className="w-4 h-4"/>
        </button>

        <div className="w-px h-5 bg-white/[0.07] mx-1"/>

        <button onClick={undo} title="Undo (Ctrl+Z)" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <Undo2 className="w-4 h-4"/>
        </button>
        <button onClick={redo} title="Redo (Ctrl+Y)" className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <Redo2 className="w-4 h-4"/>
        </button>

        <div className="w-px h-5 bg-white/[0.07] mx-1"/>

        <button onClick={exportCurrentFrame} title="Save current frame as PNG"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <Film className="w-4 h-4"/>
        </button>
        {/* Quick PNG export for drawings */}
        <button onClick={exportCurrentFrame} title="Export as PNG (drawing)"
          className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors">
          PNG
        </button>
        {/* Full export — GIF/Video/PNG-seq */}
        <button onClick={() => setLocation(`/projects/${projectId}/export`)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-all shadow-lg shadow-violet-900/30 active:scale-95">
          <Download className="w-3.5 h-3.5"/> Export GIF
        </button>
        <button onClick={() => setShowShortcuts(s => !s)} title="Shortcuts"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors ml-1">
          <MoreHorizontal className="w-4 h-4"/>
        </button>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Tool Bar ── */}
        <div className="w-12 flex flex-col items-center bg-[#0b0b18] border-r border-white/[0.06] shrink-0 overflow-y-auto py-1">
          {/* Group: draw */}
          <div className="w-full flex flex-col items-center gap-0.5 px-1 mb-1">
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

          <div className="w-7 h-px bg-white/[0.06] mb-1"/>

          {/* Group: nav */}
          <div className="w-full flex flex-col items-center gap-0.5 px-1 mb-1">
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

          <div className="w-7 h-px bg-white/[0.06] mb-1"/>

          {/* Group: shape */}
          <div className="w-full flex flex-col items-center gap-0.5 px-1 mb-1">
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

          <div className="w-7 h-px bg-white/[0.06] mb-1"/>

          {/* Color swatch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-9 h-9 rounded-xl border-2 border-white/15 hover:border-violet-500 transition-all shadow-md"
                style={{ backgroundColor: color }} onClick={() => setShowColorPanel(p => !p)}/>
            </TooltipTrigger>
            <TooltipContent side="right">Color Panel</TooltipContent>
          </Tooltip>

          <div className="w-7 h-px bg-white/[0.06] my-1"/>

          {/* Quick actions */}
          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={flipH}>
              <FlipHorizontal2 className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Flip Horizontal</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={flipV}>
              <FlipVIcon/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Flip Vertical</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={copyLayer}>
              <Copy className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Copy Layer (Ctrl+C)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center" onClick={pasteLayer}>
              <Clipboard className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Paste Layer (Ctrl+V)</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-red-400/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center" onClick={clearCurrentLayer}>
              <Trash2 className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Clear Layer</TooltipContent></Tooltip>

          <div className="w-7 h-px bg-white/[0.06] my-1"/>

          {/* Brush settings toggle */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              showBrushPanel ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => setShowBrushPanel(p => !p)}>
              <SlidersHorizontal className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Brush Settings</TooltipContent></Tooltip>

          {/* Layers panel toggle */}
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              showLayersPanel ? "bg-violet-600/30 text-violet-300" : "text-white/30 hover:text-white hover:bg-white/[0.06]")}
              onClick={() => setShowLayersPanel(p => !p)}>
              <Layers className="w-4 h-4"/>
            </button>
          </TooltipTrigger><TooltipContent side="right">Layers Panel (swipe)</TooltipContent></Tooltip>

          <div className="w-7 h-px bg-white/[0.06] my-1"/>

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
              {/* Preset colors */}
              <div className="mt-3">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Presets</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c} className="w-6 h-6 rounded-lg border-2 transition-all hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? "#8b5cf6" : "transparent" }}
                      onClick={() => commitColor(c)}/>
                  ))}
                </div>
              </div>
              {/* Recent colors */}
              <div className="mt-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Recent</span>
                <div className="flex gap-1 mt-1.5">
                  {recentColors.map((c, i) => (
                    <button key={i} className="w-6 h-6 rounded-lg border border-white/15 hover:scale-110 transition-all"
                      style={{ backgroundColor: c }} onClick={() => commitColor(c)}/>
                  ))}
                </div>
              </div>
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
            {/* Filled shape toggle */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-white/35">Filled shapes</span>
              <button className={cn("w-10 h-5 rounded-full transition-all relative",
                filledShape ? "bg-violet-600" : "bg-white/10")}
                onClick={() => setFilledShape(p => !p)}>
                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  filledShape ? "left-5" : "left-0.5")}/>
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

          <div style={{
            transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: "center",
            transition: "none",
          }} className="relative shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_48px_rgba(0,0,0,0.95)]">
            {/* Main canvas */}
            <canvas ref={canvasRef} width={CW} height={CH}
              className="block"
              style={{ width: canvasPx.w, height: "auto" }}
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
              style={{ width: canvasPx.w, height: "auto" }}
            />
            {/* Event canvas on top */}
            <canvas width={CW} height={CH}
              className="absolute inset-0 block"
              style={{
                width: canvasPx.w, height: "auto",
                cursor: tool === "move" ? "grab" : tool === "text" ? "text" : tool === "eyedropper" ? "crosshair" : "crosshair",
                touchAction: "none",
                opacity: 0,
              }}
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
                  fontFamily: "Inter, sans-serif",
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
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionPrev(p => Math.max(0, p - 1))}>
                ←{onionPrev}
              </button>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionPrev(p => Math.min(5, p + 1))}>+</button>
              <span className="text-[10px] text-white/20">|</span>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionNext(p => Math.max(0, p - 1))}>
                {onionNext}→
              </button>
              <button className="text-[10px] text-white/30 hover:text-white px-1" onClick={() => setOnionNext(p => Math.min(5, p + 1))}>+</button>
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
                      {/* Layer actions */}
                      <div className="flex gap-0.5">
                        <button className="flex-1 h-6 rounded text-[9px] text-white/30 hover:text-white hover:bg-white/10 flex items-center justify-center gap-0.5"
                          onClick={() => { setShowRenameLayer(layer.id); setRenameValue(layer.name); }}>
                          <Edit3 className="w-2.5 h-2.5"/> Rename
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
              <div className="absolute bottom-0 left-0 right-0 h-3 flex items-end px-1">
                <span className="text-[8px] text-white/30">{idx + 1}</span>
              </div>
              {currentFrameIdx === idx && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"/>}
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
