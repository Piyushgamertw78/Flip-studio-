import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject, useListFrames, useListLayers, useCreateFrame,
  useUpdateFrame, useDeleteFrame, useDuplicateFrame, useCreateLayer,
  useUpdateLayer, useDeleteLayer,
  getListFramesQueryKey, getListLayersQueryKey, getGetProjectQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Plus, Trash2,
  Eye, EyeOff, Lock, Unlock, Copy, Layers, ChevronDown,
  ZoomIn, ZoomOut, Undo2, Redo2, Download, Grid3X3,
  Pencil, PenLine, Paintbrush, Eraser, PaintBucket, Move,
  Minus, Square, Circle, Triangle, ArrowRight as ArrowTool,
  Type, Pipette, FlipHorizontal2, Ruler, ScanLine,
  ChevronLeft, ChevronRight, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Watermark } from "@/components/watermark";
import { cn } from "@/lib/utils";

type Tool =
  | "pencil" | "pen" | "brush" | "eraser" | "fill" | "move"
  | "line" | "rect" | "ellipse" | "triangle" | "arrow" | "text" | "eyedropper";

interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  points: { x: number; y: number; pressure: number }[];
  text?: string;
  x?: number;
  y?: number;
}

interface CanvasData { strokes: Stroke[]; }

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; key: string }[] = [
  { id: "pencil",    icon: <Pencil className="w-4 h-4" />,      label: "Pencil",      key: "P" },
  { id: "pen",       icon: <PenLine className="w-4 h-4" />,     label: "Pen",         key: "N" },
  { id: "brush",     icon: <Paintbrush className="w-4 h-4" />,  label: "Brush",       key: "B" },
  { id: "eraser",    icon: <Eraser className="w-4 h-4" />,      label: "Eraser",      key: "E" },
  { id: "fill",      icon: <PaintBucket className="w-4 h-4" />, label: "Fill",        key: "F" },
  { id: "eyedropper",icon: <Pipette className="w-4 h-4" />,    label: "Eyedropper",  key: "I" },
  { id: "move",      icon: <Move className="w-4 h-4" />,        label: "Pan",         key: "V" },
  { id: "line",      icon: <Minus className="w-4 h-4" />,       label: "Line",        key: "L" },
  { id: "rect",      icon: <Square className="w-4 h-4" />,      label: "Rectangle",   key: "R" },
  { id: "ellipse",   icon: <Circle className="w-4 h-4" />,      label: "Ellipse",     key: "O" },
  { id: "triangle",  icon: <Triangle className="w-4 h-4" />,    label: "Triangle",    key: "T" },
  { id: "arrow",     icon: <ArrowTool className="w-4 h-4" />,   label: "Arrow",       key: "A" },
  { id: "text",      icon: <Type className="w-4 h-4" />,        label: "Text",        key: "X" },
];

const PRESET_COLORS = [
  "#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e",
  "#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f59e0b",
  "#a855f7","#14b8a6","#fb923c","#64748b",
];

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1]!,16), g: parseInt(r[2]!,16), b: parseInt(r[3]!,16) } : null;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
}

function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, fill: string) {
  const img = ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const d = img.data, W = ctx.canvas.width, H = ctx.canvas.height;
  const i = (sy*W+sx)*4;
  const [tr,tg,tb,ta] = [d[i]!,d[i+1]!,d[i+2]!,d[i+3]!];
  const fr = hexToRgb(fill);
  if (!fr) return;
  if (tr===fr.r&&tg===fr.g&&tb===fr.b&&ta===255) return;
  const stack: number[] = [sx+sy*W];
  const seen = new Uint8Array(W*H);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue; seen[p]=1;
    const x = p%W, y = (p-x)/W;
    if (x<0||x>=W||y<0||y>=H) continue;
    const j = p*4;
    if (Math.abs(d[j]!-tr)>35||Math.abs(d[j+1]!-tg)>35||Math.abs(d[j+2]!-tb)>35) continue;
    d[j]=fr.r; d[j+1]=fr.g; d[j+2]=fr.b; d[j+3]=255;
    stack.push(p+1,p-1,p+W,p-W);
  }
  ctx.putImageData(img,0,0);
}

function drawArrow(ctx: CanvasRenderingContext2D, x1:number, y1:number, x2:number, y2:number, lw:number) {
  const angle = Math.atan2(y2-y1, x2-x1);
  const head = Math.max(lw*3, 14);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-head*Math.cos(angle-Math.PI/6), y2-head*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-head*Math.cos(angle+Math.PI/6), y2-head*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fill();
}

export default function Studio() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId) } });
  const { data: frames = [], isLoading: framesLoading } = useListFrames(projectId, { query: { queryKey: getListFramesQueryKey(projectId) } });
  const { data: layers = [], isLoading: layersLoading } = useListLayers(projectId, { query: { queryKey: getListLayersQueryKey(projectId) } });

  const createFrame = useCreateFrame();
  const updateFrame = useUpdateFrame();
  const deleteFrame = useDeleteFrame();
  const duplicateFrame = useDuplicateFrame();
  const createLayer = useCreateLayer();
  const updateLayer = useUpdateLayer();
  const deleteLayer = useDeleteLayer();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const undoStackRef = useRef<CanvasData[]>([]);
  const redoStackRef = useRef<CanvasData[]>([]);

  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushHardness, setBrushHardness] = useState(80);
  const [activeColor, setActiveColor] = useState("#000000");
  const [colorHistory, setColorHistory] = useState<string[]>(PRESET_COLORS.slice(0,8));
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [onionFrames, setOnionFrames] = useState(1);
  const [symmetryMode, setSymmetryMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sortedFrames = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const sortedLayers = [...layers].sort((a, b) => b.layerIndex - a.layerIndex);
  const currentFrame = sortedFrames[currentFrameIndex];

  useEffect(() => {
    if (sortedLayers.length > 0 && activeLayerId === null) setActiveLayerId(sortedLayers[0]?.id ?? null);
  }, [sortedLayers, activeLayerId]);

  const parseCD = (raw: string | null | undefined): CanvasData => {
    if (!raw) return { strokes: [] };
    try { return JSON.parse(raw) as CanvasData; } catch { return { strokes: [] }; }
  };

  const redrawCanvas = useCallback((canvasDataRaw: string | null | undefined, frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = project?.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(128,128,128,0.2)";
      ctx.lineWidth = 0.5;
      const step = 40;
      for (let x = 0; x <= canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      for (let y = 0; y <= canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    }

    // Onion skin — prev frames
    for (let i = 1; i <= onionFrames; i++) {
      if (onionSkin && frameIdx - i >= 0) {
        const pf = sortedFrames[frameIdx - i];
        if (pf?.canvasData) {
          const pd = parseCD(pf.canvasData);
          ctx.globalAlpha = 0.25 / i;
          renderStrokes(ctx, pd.strokes, `rgba(255,60,60,0.8)`);
          ctx.globalAlpha = 1;
        }
      }
    }
    // Onion skin — next frames
    for (let i = 1; i <= onionFrames; i++) {
      if (onionSkin && frameIdx + i < sortedFrames.length) {
        const nf = sortedFrames[frameIdx + i];
        if (nf?.canvasData) {
          const nd = parseCD(nf.canvasData);
          ctx.globalAlpha = 0.25 / i;
          renderStrokes(ctx, nd.strokes, `rgba(60,60,255,0.8)`);
          ctx.globalAlpha = 1;
        }
      }
    }

    const data = parseCD(canvasDataRaw);
    renderStrokes(ctx, data.strokes, null);
  }, [project, showGrid, onionSkin, onionFrames, sortedFrames]);

  useEffect(() => {
    if (!currentFrame) return;
    redrawCanvas(currentFrame.canvasData, currentFrame.frameIndex);
  }, [currentFrame?.id, currentFrame?.canvasData, redrawCanvas]);

  const renderStrokes = (ctx: CanvasRenderingContext2D, strokes: Stroke[], tint: string | null) => {
    for (const s of strokes) {
      ctx.save();
      ctx.strokeStyle = tint || s.color;
      ctx.fillStyle = tint || s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = tint ? 0.4 : s.opacity / 100;

      if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
      if (s.tool === "brush") { ctx.shadowBlur = s.size * (brushHardness < 50 ? (100 - brushHardness) / 10 : 0); ctx.shadowColor = tint || s.color; }

      if (s.tool === "text" && s.text && s.x !== undefined && s.y !== undefined) {
        ctx.font = `${Math.max(s.size * 3, 12)}px Inter, sans-serif`;
        ctx.fillText(s.text, s.x, s.y);
      } else if ((s.tool === "pencil" || s.tool === "pen" || s.tool === "brush" || s.tool === "eraser") && s.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(s.points[0]!.x, s.points[0]!.y);
        for (let i = 1; i < s.points.length - 1; i++) {
          const xc = (s.points[i]!.x + s.points[i+1]!.x) / 2;
          const yc = (s.points[i]!.y + s.points[i+1]!.y) / 2;
          ctx.quadraticCurveTo(s.points[i]!.x, s.points[i]!.y, xc, yc);
        }
        ctx.stroke();
      } else if (s.points.length >= 2) {
        const p0 = s.points[0]!, p1 = s.points[s.points.length - 1]!;
        if (s.tool === "line") { ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke(); }
        else if (s.tool === "rect") { ctx.strokeRect(p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); }
        else if (s.tool === "ellipse") { ctx.beginPath(); ctx.ellipse((p0.x+p1.x)/2,(p0.y+p1.y)/2,Math.abs(p1.x-p0.x)/2,Math.abs(p1.y-p0.y)/2,0,0,Math.PI*2); ctx.stroke(); }
        else if (s.tool === "triangle") { ctx.beginPath(); ctx.moveTo((p0.x+p1.x)/2,p0.y); ctx.lineTo(p1.x,p1.y); ctx.lineTo(p0.x,p1.y); ctx.closePath(); ctx.stroke(); }
        else if (s.tool === "arrow") { drawArrow(ctx,p0.x,p0.y,p1.x,p1.y,s.size); }
      }
      ctx.restore();
    }
  };

  const getCanvasPt = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }, [zoom]);

  const getCurrentStrokes = () => currentFrame ? parseCD(currentFrame.canvasData).strokes : [];

  const saveFrameData = useCallback(async (frameId: number, strokes: Stroke[]) => {
    await updateFrame.mutateAsync({ projectId, frameId, data: { canvasData: JSON.stringify({ strokes }) } });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
  }, [projectId, updateFrame, queryClient]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || activeTool === "move") {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      return;
    }
    const pt = getCanvasPt(e);

    if (activeTool === "eyedropper") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pixel = ctx.getImageData(Math.round(pt.x), Math.round(pt.y), 1, 1).data;
      const hex = rgbToHex(pixel[0]!, pixel[1]!, pixel[2]!);
      setActiveColor(hex);
      setColorHistory(prev => [hex, ...prev.filter(c => c !== hex)].slice(0,12));
      return;
    }

    if (activeTool === "text") {
      setTextInput({ x: pt.x, y: pt.y, value: "" });
      return;
    }

    if (activeTool === "fill") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const strokes = getCurrentStrokes();
      undoStackRef.current.push({ strokes: [...strokes] });
      redoStackRef.current = [];
      floodFill(ctx, Math.round(pt.x), Math.round(pt.y), activeColor);
      strokes.push({ tool: "fill", color: activeColor, size: 0, opacity: 100, points: [{ x: pt.x, y: pt.y, pressure: 1 }] });
      if (currentFrame) saveFrameData(currentFrame.id, strokes);
      return;
    }

    isDrawingRef.current = true;
    startPtRef.current = pt;

    const freehand = activeTool === "pencil" || activeTool === "pen" || activeTool === "brush" || activeTool === "eraser";
    undoStackRef.current.push({ strokes: [...getCurrentStrokes()] });
    redoStackRef.current = [];

    if (freehand) {
      currentStrokeRef.current = { tool: activeTool, color: activeColor, size: brushSize, opacity: brushOpacity, points: [{ x: pt.x, y: pt.y, pressure: e.pressure || 0.5 }] };
    } else {
      currentStrokeRef.current = { tool: activeTool, color: activeColor, size: brushSize, opacity: brushOpacity, points: [{ x: pt.x, y: pt.y, pressure: 1 }, { x: pt.x, y: pt.y, pressure: 1 }] };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current && panStartRef.current) {
      setPanX(panStartRef.current.px + (e.clientX - panStartRef.current.x));
      setPanY(panStartRef.current.py + (e.clientY - panStartRef.current.y));
      return;
    }
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pt = getCanvasPt(e);
    const freehand = activeTool === "pencil" || activeTool === "pen" || activeTool === "brush" || activeTool === "eraser";

    if (freehand) {
      currentStrokeRef.current.points.push({ x: pt.x, y: pt.y, pressure: e.pressure || 0.5 });
      // Incremental paint
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = currentStrokeRef.current;
      const pts = s.points;
      const len = pts.length;
      ctx.save();
      ctx.globalAlpha = s.opacity / 100;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * (pts[len-1]!.pressure || 0.5);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
      if (s.tool === "brush") { ctx.shadowBlur = s.size * 0.5; ctx.shadowColor = s.color; }
      if (len >= 3) {
        const xc = (pts[len-2]!.x + pts[len-1]!.x) / 2;
        const yc = (pts[len-2]!.y + pts[len-1]!.y) / 2;
        ctx.beginPath();
        ctx.moveTo((pts[len-3]!.x+pts[len-2]!.x)/2, (pts[len-3]!.y+pts[len-2]!.y)/2);
        ctx.quadraticCurveTo(pts[len-2]!.x, pts[len-2]!.y, xc, yc);
        ctx.stroke();
      }
      // Symmetry mirror
      if (symmetryMode) {
        const W = canvas.width;
        const mx = W - pt.x;
        const mp = { x: mx, y: pt.y, pressure: e.pressure || 0.5 };
        ctx.beginPath();
        if (len >= 3) {
          const pM = { x: W - pts[len-3]!.x, y: pts[len-3]!.y };
          const pM2 = { x: W - pts[len-2]!.x, y: pts[len-2]!.y };
          ctx.moveTo((pM.x+pM2.x)/2, (pM.y+pM2.y)/2);
          ctx.quadraticCurveTo(pM2.x, pM2.y, (pM2.x+mx)/2, (pM2.y+pt.y)/2);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else {
      // Shape: update last point + draw on overlay
      currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1] = { x: pt.x, y: pt.y, pressure: 1 };
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      renderStrokes(ctx, [currentStrokeRef.current], null);
    }
  };

  const handlePointerUp = () => {
    isPanningRef.current = false; panStartRef.current = null;
    if (!isDrawingRef.current || !currentStrokeRef.current || !currentFrame) return;
    isDrawingRef.current = false;
    const overlay = overlayRef.current;
    if (overlay) { const ctx = overlay.getContext("2d"); ctx?.clearRect(0,0,overlay.width,overlay.height); }
    const strokes = getCurrentStrokes();
    strokes.push(currentStrokeRef.current);
    saveFrameData(currentFrame.id, strokes);
    currentStrokeRef.current = null; startPtRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.1, Math.min(12, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const undo = useCallback(async () => {
    if (!undoStackRef.current.length || !currentFrame) return;
    redoStackRef.current.push(parseCD(currentFrame.canvasData));
    const prev = undoStackRef.current.pop()!;
    await saveFrameData(currentFrame.id, prev.strokes);
    redrawCanvas(JSON.stringify(prev), currentFrameIndex);
  }, [currentFrame, currentFrameIndex, saveFrameData, redrawCanvas]);

  const redo = useCallback(async () => {
    if (!redoStackRef.current.length || !currentFrame) return;
    undoStackRef.current.push(parseCD(currentFrame.canvasData));
    const next = redoStackRef.current.pop()!;
    await saveFrameData(currentFrame.id, next.strokes);
    redrawCanvas(JSON.stringify(next), currentFrameIndex);
  }, [currentFrame, currentFrameIndex, saveFrameData, redrawCanvas]);

  const flipHorizontal = async () => {
    if (!currentFrame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    const flipped = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const src = (y * W + x) * 4;
        const dst = (y * W + (W - 1 - x)) * 4;
        flipped.data[dst] = img.data[src]!;
        flipped.data[dst+1] = img.data[src+1]!;
        flipped.data[dst+2] = img.data[src+2]!;
        flipped.data[dst+3] = img.data[src+3]!;
      }
    }
    ctx.putImageData(flipped, 0, 0);
    const strokes = getCurrentStrokes().map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p, x: W - p.x })),
      x: s.x !== undefined ? W - s.x : undefined,
    }));
    if (currentFrame) await saveFrameData(currentFrame.id, strokes);
  };

  const commitText = async (value: string) => {
    if (!textInput || !value.trim() || !currentFrame) { setTextInput(null); return; }
    const strokes = getCurrentStrokes();
    strokes.push({ tool: "text", color: activeColor, size: brushSize, opacity: brushOpacity, points: [{ x: textInput.x, y: textInput.y, pressure: 1 }], text: value, x: textInput.x, y: textInput.y });
    await saveFrameData(currentFrame.id, strokes);
    setTextInput(null);
    redrawCanvas(JSON.stringify({ strokes }), currentFrameIndex);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || textInput) return;
      const toolMap: Record<string, Tool> = { p:"pencil", n:"pen", b:"brush", e:"eraser", f:"fill", i:"eyedropper", v:"move", l:"line", r:"rect", o:"ellipse", t:"triangle", a:"arrow", x:"text" };
      if (!e.ctrlKey && !e.metaKey && toolMap[e.key.toLowerCase()]) setActiveTool(toolMap[e.key.toLowerCase()]!);
      if ((e.ctrlKey||e.metaKey) && e.key==="z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && (e.key==="y"||(e.key==="z"&&e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key==="[") setBrushSize(s => Math.max(1, s - 2));
      if (e.key==="]") setBrushSize(s => Math.min(200, s + 2));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, textInput]);

  // Playback
  useEffect(() => {
    if (isPlaying) {
      const fps = project?.fps ?? 12;
      playIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex(i => (i + 1) % Math.max(1, sortedFrames.length));
      }, 1000 / fps);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, project?.fps, sortedFrames.length]);

  const addFrame = async () => {
    await createFrame.mutateAsync({ projectId, data: { frameIndex: sortedFrames.length, duration: 1 } });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    setCurrentFrameIndex(sortedFrames.length);
  };

  const canvasW = project?.canvasWidth ?? 1280;
  const canvasH = project?.canvasHeight ?? 720;

  if (projectLoading || framesLoading || layersLoading) {
    return <div className="h-screen w-screen bg-background flex items-center justify-center"><Skeleton className="h-12 w-48" /></div>;
  }

  const isShape = ["line","rect","ellipse","triangle","arrow"].includes(activeTool);

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(240,7%,5%)] text-foreground overflow-hidden select-none">
      {/* ── Top Toolbar ── */}
      <div className="h-12 flex items-center px-3 gap-1.5 border-b border-border bg-card shrink-0 z-10">
        <Tooltip><TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/")}><ArrowLeft className="w-4 h-4" /></Button>
        </TooltipTrigger><TooltipContent>Dashboard</TooltipContent></Tooltip>

        <div className="w-px h-6 bg-border" />
        <span className="text-sm font-semibold truncate max-w-[180px]">{project?.name}</span>
        <div className="flex-1" />

        {/* Undo/Redo */}
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo}><Undo2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo}><Redo2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>
        <div className="w-px h-6 bg-border" />

        {/* Flip */}
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={flipHorizontal}><FlipHorizontal2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Flip Horizontal</TooltipContent></Tooltip>
        <div className="w-px h-6 bg-border" />

        {/* Playback */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsPlaying(false); setCurrentFrameIndex(0); }}><SkipBack className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentFrameIndex(i => Math.max(0, i - 1))}><ChevronLeft className="w-4 h-4" /></Button>
        <Button variant={isPlaying ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentFrameIndex(i => Math.min(sortedFrames.length - 1, i + 1))}><ChevronRight className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentFrameIndex(Math.max(0, sortedFrames.length - 1))}><SkipForward className="w-4 h-4" /></Button>

        <span className="text-xs text-muted-foreground tabular-nums px-1">{currentFrameIndex + 1} / {sortedFrames.length} · {project?.fps ?? 12}fps</span>
        <div className="w-px h-6 bg-border" />

        {/* Zoom */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.1, z * 0.8))}><ZoomOut className="w-4 h-4" /></Button>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(12, z * 1.25))}><ZoomIn className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}><Grid3X3 className="w-4 h-4" /></Button>
        <div className="w-px h-6 bg-border" />

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLocation(`/projects/${projectId}/export`)}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <div className="w-px h-6 bg-border mx-0.5" />
        <span className="text-[10px] text-muted-foreground/35 select-none font-mono">✦ Made By Piyush</span>
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tool Icons */}
        <div className="w-12 flex flex-col items-center py-2 gap-0.5 border-r border-border bg-card shrink-0 overflow-y-auto">
          {TOOLS.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-lg transition-all shrink-0",
                    activeTool === t.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  onClick={() => setActiveTool(t.id)}
                >
                  {t.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t.label} ({t.key})</TooltipContent>
            </Tooltip>
          ))}

          <div className="w-8 border-t border-border my-1.5" />

          {/* Color swatch */}
          <Tooltip><TooltipTrigger asChild>
            <label className="relative cursor-pointer w-9 h-9 rounded-lg border-2 border-border hover:border-primary/50 transition-colors overflow-hidden" style={{ backgroundColor: activeColor }}>
              <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" value={activeColor} onChange={e => { setActiveColor(e.target.value); setColorHistory(p => [e.target.value, ...p.filter(c => c !== e.target.value)].slice(0,12)); }} />
            </label>
          </TooltipTrigger><TooltipContent side="right">Color</TooltipContent></Tooltip>
        </div>

        {/* Left: Options panel */}
        <div className="w-44 flex flex-col gap-3 p-3 border-r border-border bg-card shrink-0 overflow-y-auto text-[11px]">
          {/* Size */}
          <div>
            <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Size <span className="text-primary float-right">{brushSize}px</span></div>
            <Slider value={[brushSize]} min={1} max={200} step={1} onValueChange={([v]) => v !== undefined && setBrushSize(v)} />
            <div className="text-muted-foreground/60 mt-1">[ ] keys to adjust</div>
          </div>

          {/* Opacity */}
          <div>
            <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Opacity <span className="text-primary float-right">{brushOpacity}%</span></div>
            <Slider value={[brushOpacity]} min={1} max={100} step={1} onValueChange={([v]) => v !== undefined && setBrushOpacity(v)} />
          </div>

          {/* Hardness (brush only) */}
          {activeTool === "brush" && (
            <div>
              <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Hardness <span className="text-primary float-right">{brushHardness}%</span></div>
              <Slider value={[brushHardness]} min={0} max={100} step={1} onValueChange={([v]) => v !== undefined && setBrushHardness(v)} />
            </div>
          )}

          {/* Color palette */}
          <div>
            <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Colors</div>
            <div className="grid grid-cols-4 gap-1">
              {PRESET_COLORS.map(c => (
                <button key={c} className={cn("w-7 h-7 rounded border-2 transition-transform hover:scale-110", c === activeColor ? "border-primary" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => { setActiveColor(c); setColorHistory(p => [c, ...p.filter(x => x !== c)].slice(0,12)); }} />
              ))}
            </div>
          </div>

          {/* Recent colors */}
          {colorHistory.length > 0 && (
            <div>
              <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Recent</div>
              <div className="flex flex-wrap gap-1">
                {colorHistory.slice(0,8).map((c,i) => (
                  <button key={i} className={cn("w-6 h-6 rounded border-2 transition-transform hover:scale-110", c === activeColor ? "border-primary" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setActiveColor(c)} />
                ))}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-1">
            {[
              { label: "Onion Skin", val: onionSkin, set: setOnionSkin, icon: <Film className="w-3 h-3" /> },
              { label: "Symmetry", val: symmetryMode, set: setSymmetryMode, icon: <FlipHorizontal2 className="w-3 h-3" /> },
              { label: "Grid", val: showGrid, set: setShowGrid, icon: <Grid3X3 className="w-3 h-3" /> },
              { label: "Ruler", val: showRuler, set: setShowRuler, icon: <Ruler className="w-3 h-3" /> },
            ].map(({ label, val, set, icon }) => (
              <button key={label} className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-colors", val ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent")} onClick={() => set(!val)}>
                {icon} {label}
                <div className={cn("ml-auto w-7 h-3.5 rounded-full transition-colors relative", val ? "bg-primary" : "bg-muted")}>
                  <div className={cn("absolute w-3 h-3 rounded-full bg-white top-0.5 transition-transform shadow-sm", val ? "translate-x-3.5" : "translate-x-0.5")} />
                </div>
              </button>
            ))}
          </div>

          {/* Onion frames count */}
          {onionSkin && (
            <div>
              <div className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Onion Frames <span className="text-primary float-right">{onionFrames}</span></div>
              <Slider value={[onionFrames]} min={1} max={5} step={1} onValueChange={([v]) => v !== undefined && setOnionFrames(v)} />
            </div>
          )}

          {/* Preview swatch */}
          <div className="w-full h-10 rounded-lg border border-border" style={{ backgroundColor: activeColor, opacity: brushOpacity / 100 }} />
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[hsl(240,7%,7%)]" onWheel={handleWheel} ref={containerRef}>
          {/* Checker */}
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(45deg,hsl(240,7%,11%) 25%,transparent 25%),linear-gradient(-45deg,hsl(240,7%,11%) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,hsl(240,7%,11%) 75%),linear-gradient(-45deg,transparent 75%,hsl(240,7%,11%) 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px" }} />

          {/* Ruler */}
          {showRuler && (
            <>
              <div className="absolute top-0 left-8 right-0 h-6 bg-card/80 border-b border-border z-10 flex items-end overflow-hidden">
                {Array.from({ length: Math.ceil(canvasW * zoom / 50) }).map((_, i) => (
                  <div key={i} className="flex-none text-[8px] text-muted-foreground/50 border-r border-border/40 text-right pr-0.5" style={{ width: 50, lineHeight: "8px" }}>{Math.round(i * 50 / zoom)}</div>
                ))}
              </div>
              <div className="absolute top-6 left-0 bottom-0 w-8 bg-card/80 border-r border-border z-10">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="text-[8px] text-muted-foreground/50 border-b border-border/40 flex items-center justify-end pr-0.5" style={{ height: 50 }}>{Math.round(i * 50 / zoom)}</div>
                ))}
              </div>
            </>
          )}

          {/* Symmetry line */}
          {symmetryMode && (
            <div className="absolute pointer-events-none z-20" style={{
              left: `calc(50% + ${panX}px)`,
              top: showRuler ? 24 : 0,
              bottom: 0,
              width: 1,
              background: "rgba(139,92,246,0.5)",
              boxShadow: "0 0 8px rgba(139,92,246,0.4)",
            }} />
          )}

          <div className="absolute" style={{ transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`, top: "50%", left: "50%", transformOrigin: "center" }}>
            <div className="shadow-2xl shadow-black/60 relative" style={{ width: canvasW, height: canvasH }}>
              <canvas ref={canvasRef} width={canvasW} height={canvasH} className="absolute inset-0 block" />
              <canvas
                ref={overlayRef}
                width={canvasW}
                height={canvasH}
                className={cn("absolute inset-0 block touch-none", activeTool === "move" ? "cursor-grab" : activeTool === "eraser" ? "cursor-cell" : activeTool === "text" ? "cursor-text" : activeTool === "eyedropper" ? "cursor-crosshair" : "cursor-crosshair")}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              {textInput && (
                <input
                  autoFocus type="text"
                  className="absolute bg-transparent border-none outline-none"
                  style={{ left: textInput.x, top: textInput.y - brushSize * 3, fontSize: `${Math.max(brushSize * 3, 12)}px`, color: activeColor, fontFamily: "Inter, sans-serif", minWidth: 80 }}
                  value={textInput.value}
                  onChange={e => setTextInput({ ...textInput, value: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") commitText(textInput.value); if (e.key === "Escape") setTextInput(null); }}
                  onBlur={() => commitText(textInput.value)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Layers */}
        <div className={cn("flex flex-col border-l border-border bg-card shrink-0 transition-all", layerPanelOpen ? "w-52" : "w-10")}>
          <button className="h-10 flex items-center justify-between px-3 border-b border-border text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setLayerPanelOpen(!layerPanelOpen)}>
            {layerPanelOpen ? <><span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />Layers</span><ChevronDown className="w-3.5 h-3.5" /></> : <Layers className="w-4 h-4 mx-auto" />}
          </button>
          {layerPanelOpen && (
            <>
              <div className="flex-1 overflow-y-auto">
                {sortedLayers.map(layer => (
                  <div key={layer.id} className={cn("flex items-center gap-1.5 px-2 py-2 border-b border-border cursor-pointer hover:bg-accent/50 group", activeLayerId === layer.id ? "bg-primary/10 border-l-2 border-l-primary" : "")} onClick={() => setActiveLayerId(layer.id)}>
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); updateLayer.mutate({ projectId, layerId: layer.id, data: { isVisible: !layer.isVisible } }); queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) }); }}>
                      {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                    </button>
                    <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); updateLayer.mutate({ projectId, layerId: layer.id, data: { isLocked: !layer.isLocked } }); queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) }); }}>
                      {layer.isLocked ? <Lock className="w-3.5 h-3.5 text-yellow-500" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <span className="flex-1 text-xs truncate">{layer.name}</span>
                    <button className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); if (layers.length > 1) { deleteLayer.mutate({ projectId, layerId: layer.id }); queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) }); } }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-border">
                <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={async () => { await createLayer.mutateAsync({ projectId, data: { name: `Layer ${layers.length + 1}` } }); queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) }); }}>
                  <Plus className="w-3 h-3" /> Add Layer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="h-36 border-t border-border bg-card flex flex-col shrink-0">
        <div className="h-9 flex items-center px-3 gap-2 border-b border-border text-xs">
          <span className="text-muted-foreground font-medium">Timeline</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addFrame}><Plus className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { if (!currentFrame) return; await duplicateFrame.mutateAsync({ projectId, frameId: currentFrame.id }); queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) }); setCurrentFrameIndex(currentFrameIndex + 1); }}><Copy className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={async () => { if (!currentFrame || sortedFrames.length <= 1) return; await deleteFrame.mutateAsync({ projectId, frameId: currentFrame.id }); queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) }); setCurrentFrameIndex(i => Math.max(0, i - 1)); }} disabled={sortedFrames.length <= 1}><Trash2 className="w-3.5 h-3.5" /></Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-muted-foreground">{project?.fps ?? 12} fps</span>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-2 flex items-center gap-1">
          {sortedFrames.map((frame, idx) => (
            <button key={frame.id} className={cn("flex-shrink-0 flex flex-col items-center gap-0.5 rounded-md border-2 overflow-hidden transition-all hover:border-primary/50", idx === currentFrameIndex ? "border-primary shadow-md shadow-primary/30" : "border-border")} style={{ width: 70 }} onClick={() => { setIsPlaying(false); setCurrentFrameIndex(idx); }}>
              <div className="w-full flex items-center justify-center bg-muted" style={{ height: 54, backgroundColor: project?.backgroundColor ?? "#fff" }}>
                {frame.thumbnailData ? <img src={frame.thumbnailData} alt="" className="w-full h-full object-cover" /> : <ScanLine className="w-4 h-4 text-muted-foreground/20" />}
              </div>
              <span className="text-[10px] text-muted-foreground pb-0.5 tabular-nums">{idx + 1}</span>
            </button>
          ))}
          <button className="flex-shrink-0 w-14 h-16 flex items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors" onClick={addFrame}>
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Watermark />
    </div>
  );
}
