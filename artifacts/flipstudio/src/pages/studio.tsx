import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject,
  useListFrames,
  useListLayers,
  useCreateFrame,
  useUpdateFrame,
  useDeleteFrame,
  useDuplicateFrame,
  useCreateLayer,
  useUpdateLayer,
  useDeleteLayer,
  useReorderLayers,
  getListFramesQueryKey,
  getListLayersQueryKey,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Plus, Trash2,
  Eye, EyeOff, Lock, Unlock, Copy, Layers, ChevronDown, ChevronUp,
  ZoomIn, ZoomOut, Undo2, Redo2, Download, Settings, Grid3X3,
  Pencil, PenLine, Paintbrush, Eraser, PaintBucket, Move, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tool = "pencil" | "pen" | "brush" | "eraser" | "fill" | "move";

interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  points: { x: number; y: number; pressure: number }[];
}

interface CanvasData {
  strokes: Stroke[];
}

const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  pencil: <Pencil className="w-4 h-4" />,
  pen: <PenLine className="w-4 h-4" />,
  brush: <Paintbrush className="w-4 h-4" />,
  eraser: <Eraser className="w-4 h-4" />,
  fill: <PaintBucket className="w-4 h-4" />,
  move: <Move className="w-4 h-4" />,
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: "Pencil",
  pen: "Pen",
  brush: "Brush",
  eraser: "Eraser",
  fill: "Fill",
  move: "Move",
};

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
  "#92400e", "#064e3b",
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16),
      }
    : null;
}

function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const idx = (startY * width + startX) * 4;
  const targetR = data[idx]!;
  const targetG = data[idx + 1]!;
  const targetB = data[idx + 2]!;
  const targetA = data[idx + 3]!;

  const fillRgb = hexToRgb(fillColor);
  if (!fillRgb) return;

  if (
    targetR === fillRgb.r &&
    targetG === fillRgb.g &&
    targetB === fillRgb.b &&
    targetA === 255
  )
    return;

  const stack: [number, number][] = [[startX, startY]];
  const visited = new Set<number>();

  const matchesTarget = (i: number) => {
    return (
      Math.abs(data[i]! - targetR) < 30 &&
      Math.abs(data[i + 1]! - targetG) < 30 &&
      Math.abs(data[i + 2]! - targetB) < 30 &&
      Math.abs(data[i + 3]! - targetA) < 30
    );
  };

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const i = (y * width + x) * 4;
    if (visited.has(i)) continue;
    if (!matchesTarget(i)) continue;

    visited.add(i);
    data[i] = fillRgb.r;
    data[i + 1] = fillRgb.g;
    data[i + 2] = fillRgb.b;
    data[i + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

export default function Studio() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // API hooks
  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: { queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: frames = [], isLoading: framesLoading } = useListFrames(projectId, {
    query: { queryKey: getListFramesQueryKey(projectId) },
  });
  const { data: layers = [], isLoading: layersLoading } = useListLayers(projectId, {
    query: { queryKey: getListLayersQueryKey(projectId) },
  });
  const createFrame = useCreateFrame();
  const updateFrame = useUpdateFrame();
  const deleteFrame = useDeleteFrame();
  const duplicateFrame = useDuplicateFrame();
  const createLayer = useCreateLayer();
  const updateLayer = useUpdateLayer();
  const deleteLayer = useDeleteLayer();
  const reorderLayers = useReorderLayers();

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const strokeHistoryRef = useRef<Map<number, Stroke[][]>>(new Map());

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [activeColor, setActiveColor] = useState("#000000");
  const [colorHistory, setColorHistory] = useState<string[]>(PRESET_COLORS.slice(0, 6));

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Frame / playback state
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Undo/redo
  const undoStackRef = useRef<CanvasData[]>([]);
  const redoStackRef = useRef<CanvasData[]>([]);

  // UI state
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);

  // Sorted data
  const sortedFrames = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const sortedLayers = [...layers].sort((a, b) => b.layerIndex - a.layerIndex);
  const currentFrame = sortedFrames[currentFrameIndex];

  // Set default active layer
  useEffect(() => {
    if (sortedLayers.length > 0 && activeLayerId === null) {
      setActiveLayerId(sortedLayers[0]?.id ?? null);
    }
  }, [sortedLayers, activeLayerId]);

  // Draw canvas when frame changes
  useEffect(() => {
    if (!currentFrame || !canvasRef.current) return;
    redrawCanvas(currentFrame.canvasData, currentFrame.frameIndex);
  }, [currentFrame?.id, currentFrame?.canvasData]);

  const parseCanvasData = (raw: string | null | undefined): CanvasData => {
    if (!raw) return { strokes: [] };
    try {
      return JSON.parse(raw) as CanvasData;
    } catch {
      return { strokes: [] };
    }
  };

  const redrawCanvas = useCallback((canvasDataRaw: string | null | undefined, frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (project) {
      ctx.fillStyle = project.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw onion skin (previous frame)
    if (onionSkin && frameIdx > 0) {
      const prevFrame = sortedFrames[frameIdx - 1];
      if (prevFrame?.canvasData) {
        const prevData = parseCanvasData(prevFrame.canvasData);
        ctx.globalAlpha = 0.3;
        renderStrokes(ctx, prevData.strokes, "#ff4444");
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw onion skin (next frame)
    if (onionSkin && frameIdx < sortedFrames.length - 1) {
      const nextFrame = sortedFrames[frameIdx + 1];
      if (nextFrame?.canvasData) {
        const nextData = parseCanvasData(nextFrame.canvasData);
        ctx.globalAlpha = 0.3;
        renderStrokes(ctx, nextData.strokes, "#4444ff");
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw current frame strokes
    const data = parseCanvasData(canvasDataRaw);
    renderStrokes(ctx, data.strokes, null);
  }, [project, onionSkin, sortedFrames]);

  const renderStrokes = (
    ctx: CanvasRenderingContext2D,
    strokes: Stroke[],
    tintColor: string | null
  ) => {
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      ctx.globalAlpha = tintColor ? 0.3 : stroke.opacity / 100;
      ctx.strokeStyle = tintColor || stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
      } else if (stroke.tool === "brush") {
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = stroke.size * 0.5;
        ctx.shadowColor = tintColor || stroke.color;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i]!.x + stroke.points[i + 1]!.x) / 2;
        const yc = (stroke.points[i]!.y + stroke.points[i + 1]!.y) / 2;
        ctx.quadraticCurveTo(stroke.points[i]!.x, stroke.points[i]!.y, xc, yc);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
    }
  };

  const getCanvasPoint = (e: React.PointerEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const saveFrameData = useCallback(async (frameId: number, strokes: Stroke[]) => {
    if (!project) return;
    const data: CanvasData = { strokes };
    await updateFrame.mutateAsync({
      projectId,
      frameId,
      data: { canvasData: JSON.stringify(data) },
    });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
  }, [projectId, project, updateFrame, queryClient]);

  const getCurrentStrokes = (): Stroke[] => {
    if (!currentFrame) return [];
    return parseCanvasData(currentFrame.canvasData).strokes;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || activeTool === "move") {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
      return;
    }
    if (activeTool === "fill") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pt = getCanvasPoint(e);
      floodFill(ctx, Math.round(pt.x), Math.round(pt.y), activeColor);

      // Save strokes (fill is saved as a "fill" stroke marker)
      const strokes = getCurrentStrokes();
      strokes.push({ tool: "fill", color: activeColor, size: 0, opacity: 100, points: [{ x: pt.x, y: pt.y, pressure: 1 }] });
      if (currentFrame) saveFrameData(currentFrame.id, strokes);
      return;
    }

    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    const pressure = e.pressure || 0.5;

    // Save undo state
    const currentStrokes = getCurrentStrokes();
    undoStackRef.current.push({ strokes: [...currentStrokes] });
    redoStackRef.current = [];

    currentStrokeRef.current = {
      tool: activeTool,
      color: activeColor,
      size: brushSize,
      opacity: brushOpacity,
      points: [{ x: pt.x, y: pt.y, pressure }],
    };
    lastPointRef.current = pt;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current && panStartRef.current) {
      setPanX(panStartRef.current.panX + (e.clientX - panStartRef.current.x));
      setPanY(panStartRef.current.panY + (e.clientY - panStartRef.current.y));
      return;
    }
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    const pressure = e.pressure || 0.5;
    currentStrokeRef.current.points.push({ x: pt.x, y: pt.y, pressure });

    // Real-time drawing
    const stroke = currentStrokeRef.current;
    const points = stroke.points;
    if (points.length < 2) return;

    ctx.globalAlpha = stroke.opacity / 100;
    ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;

    const speedFactor = lastPointRef.current
      ? Math.hypot(pt.x - lastPointRef.current.x, pt.y - lastPointRef.current.y)
      : 0;
    const dynamicSize = stroke.tool === "pencil"
      ? Math.max(stroke.size * 0.4, stroke.size - speedFactor * 0.1) * pressure
      : stroke.size * pressure;

    ctx.lineWidth = dynamicSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else if (stroke.tool === "brush") {
      ctx.shadowBlur = stroke.size * 0.5;
      ctx.shadowColor = stroke.color;
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    }

    const len = points.length;
    if (len >= 3) {
      const prev = points[len - 2]!;
      const curr = points[len - 1]!;
      const prevPrev = points[len - 3]!;
      const xc = (prevPrev.x + prev.x) / 2;
      const yc = (prevPrev.y + prev.y) / 2;
      const xc2 = (prev.x + curr.x) / 2;
      const yc2 = (prev.y + curr.y) / 2;

      ctx.beginPath();
      ctx.moveTo(xc, yc);
      ctx.quadraticCurveTo(prev.x, prev.y, xc2, yc2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[len - 2]!.x, points[len - 2]!.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    isPanningRef.current = false;
    panStartRef.current = null;

    if (!isDrawingRef.current || !currentStrokeRef.current || !currentFrame) return;
    isDrawingRef.current = false;

    const strokes = getCurrentStrokes();
    strokes.push(currentStrokeRef.current);
    saveFrameData(currentFrame.id, strokes);
    currentStrokeRef.current = null;
    lastPointRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(10, z * delta)));
  };

  // Undo
  const undo = useCallback(async () => {
    if (undoStackRef.current.length === 0 || !currentFrame) return;
    const currentData = parseCanvasData(currentFrame.canvasData);
    redoStackRef.current.push(currentData);
    const prev = undoStackRef.current.pop()!;
    await saveFrameData(currentFrame.id, prev.strokes);
    redrawCanvas(JSON.stringify(prev), currentFrameIndex);
  }, [currentFrame, currentFrameIndex, saveFrameData, redrawCanvas]);

  const redo = useCallback(async () => {
    if (redoStackRef.current.length === 0 || !currentFrame) return;
    const currentData = parseCanvasData(currentFrame.canvasData);
    undoStackRef.current.push(currentData);
    const next = redoStackRef.current.pop()!;
    await saveFrameData(currentFrame.id, next.strokes);
    redrawCanvas(JSON.stringify(next), currentFrameIndex);
  }, [currentFrame, currentFrameIndex, saveFrameData, redrawCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "p") setActiveTool("pencil");
      if (e.key === "b") setActiveTool("brush");
      if (e.key === "e") setActiveTool("eraser");
      if (e.key === "f") setActiveTool("fill");
      if (e.key === "v") setActiveTool("move");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Playback
  useEffect(() => {
    if (isPlaying) {
      const fps = project?.fps ?? 12;
      playIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex((i) => (i + 1) % Math.max(1, sortedFrames.length));
      }, 1000 / fps);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, project?.fps, sortedFrames.length]);

  const addFrame = async () => {
    await createFrame.mutateAsync({
      projectId,
      data: { frameIndex: sortedFrames.length, duration: 1 },
    });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    setCurrentFrameIndex(sortedFrames.length);
  };

  const handleDeleteFrame = async () => {
    if (!currentFrame || sortedFrames.length <= 1) return;
    await deleteFrame.mutateAsync({ projectId, frameId: currentFrame.id });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    setCurrentFrameIndex((i) => Math.max(0, i - 1));
  };

  const handleDuplicateFrame = async () => {
    if (!currentFrame) return;
    await duplicateFrame.mutateAsync({ projectId, frameId: currentFrame.id });
    queryClient.invalidateQueries({ queryKey: getListFramesQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    setCurrentFrameIndex(currentFrameIndex + 1);
  };

  const addLayer = async () => {
    await createLayer.mutateAsync({
      projectId,
      data: { name: `Layer ${layers.length + 1}` },
    });
    queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) });
  };

  const handleDeleteLayer = async (layerId: number) => {
    if (layers.length <= 1) return;
    await deleteLayer.mutateAsync({ projectId, layerId });
    queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) });
  };

  const selectColor = (color: string) => {
    setActiveColor(color);
    setColorHistory((prev) => {
      const next = [color, ...prev.filter((c) => c !== color)].slice(0, 12);
      return next;
    });
  };

  const canvasWidth = project?.canvasWidth ?? 1280;
  const canvasHeight = project?.canvasHeight ?? 720;

  if (projectLoading || framesLoading || layersLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(240,7%,5%)] text-foreground overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="h-12 flex items-center px-3 gap-2 border-b border-border bg-card shrink-0 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation("/")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Dashboard</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        <span className="text-sm font-semibold truncate max-w-[200px] text-foreground">
          {project?.name ?? "Loading..."}
        </span>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} data-testid="button-undo">
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} data-testid="button-redo">
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Playback */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsPlaying(false); setCurrentFrameIndex(0); }} data-testid="button-skip-back">
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant={isPlaying ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsPlaying(!isPlaying)}
          data-testid="button-play"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentFrameIndex(Math.max(0, sortedFrames.length - 1))} data-testid="button-skip-forward">
          <SkipForward className="w-4 h-4" />
        </Button>

        <span className="text-xs text-muted-foreground tabular-nums">
          {currentFrameIndex + 1} / {sortedFrames.length}
        </span>
        <span className="text-xs text-muted-foreground">{project?.fps ?? 12} FPS</span>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Zoom */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} data-testid="button-zoom-out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(10, z * 1.25))} data-testid="button-zoom-in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} data-testid="button-zoom-reset">
          <Grid3X3 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLocation(`/projects/${projectId}/export`)} data-testid="button-export">
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tool Sidebar */}
        <div className="w-14 flex flex-col items-center py-3 gap-1 border-r border-border bg-card shrink-0 z-10">
          {(Object.keys(TOOL_ICONS) as Tool[]).map((tool) => (
            <Tooltip key={tool}>
              <TooltipTrigger asChild>
                <button
                  data-testid={`tool-${tool}`}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                    activeTool === tool
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  onClick={() => setActiveTool(tool)}
                >
                  {TOOL_ICONS[tool]}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{TOOL_LABELS[tool]}</TooltipContent>
            </Tooltip>
          ))}

          <div className="w-full border-t border-border my-2" />

          {/* Color swatch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="relative cursor-pointer">
                <div
                  className="w-9 h-9 rounded-lg border-2 border-border cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                  data-testid="color-swatch"
                />
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={activeColor}
                  onChange={(e) => selectColor(e.target.value)}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="right">Color</TooltipContent>
          </Tooltip>

          <div className="w-full border-t border-border my-2" />

          {/* Color history */}
          <div className="flex flex-col gap-1 items-center">
            {colorHistory.slice(0, 8).map((c, i) => (
              <button
                key={i}
                className={cn(
                  "w-6 h-6 rounded border transition-transform",
                  c === activeColor ? "border-primary scale-110" : "border-border hover:scale-105"
                )}
                style={{ backgroundColor: c }}
                onClick={() => selectColor(c)}
                data-testid={`color-history-${i}`}
              />
            ))}
          </div>
        </div>

        {/* Tool Options Bar (left sidebar extension) */}
        <div className="w-44 flex flex-col gap-4 p-3 border-r border-border bg-card shrink-0 overflow-y-auto">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Size</div>
            <div className="flex items-center gap-2">
              <Minus className="w-3 h-3 text-muted-foreground" />
              <Slider
                value={[brushSize]}
                min={1}
                max={100}
                step={1}
                onValueChange={([v]) => v !== undefined && setBrushSize(v)}
                className="flex-1"
                data-testid="slider-size"
              />
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{brushSize}px</span>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Opacity</div>
            <div className="flex items-center gap-2">
              <Minus className="w-3 h-3 text-muted-foreground" />
              <Slider
                value={[brushOpacity]}
                min={1}
                max={100}
                step={1}
                onValueChange={([v]) => v !== undefined && setBrushOpacity(v)}
                className="flex-1"
                data-testid="slider-opacity"
              />
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{brushOpacity}%</span>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Colors</div>
            <div className="grid grid-cols-4 gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "w-7 h-7 rounded border-2 transition-transform hover:scale-110",
                    c === activeColor ? "border-primary" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => selectColor(c)}
                  data-testid={`preset-color-${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Preview</div>
            <div
              className="w-full h-16 rounded-lg border border-border"
              style={{ backgroundColor: activeColor, opacity: brushOpacity / 100 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <button
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                onionSkin ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
              onClick={() => setOnionSkin(!onionSkin)}
              data-testid="toggle-onion-skin"
            >
              <Layers className="w-3.5 h-3.5" />
              Onion Skin
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          className="flex-1 relative overflow-hidden bg-[hsl(240,7%,7%)]"
          onWheel={handleWheel}
          ref={containerRef}
        >
          {/* Checker background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, hsl(240,7%,12%) 25%, transparent 25%), linear-gradient(-45deg, hsl(240,7%,12%) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(240,7%,12%) 75%), linear-gradient(-45deg, transparent 75%, hsl(240,7%,12%) 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            }}
          />

          {/* Canvas transform wrapper */}
          <div
            className="absolute"
            style={{
              transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`,
              top: "50%",
              left: "50%",
              transformOrigin: "center",
            }}
          >
            <div className="shadow-2xl shadow-black/60">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className={cn(
                  "block touch-none",
                  activeTool === "eraser" ? "cursor-cell" : activeTool === "move" ? "cursor-grab" : "cursor-crosshair"
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                data-testid="drawing-canvas"
              />
            </div>
          </div>
        </div>

        {/* Right: Layer Panel */}
        <div className={cn("flex flex-col border-l border-border bg-card shrink-0 transition-all", layerPanelOpen ? "w-52" : "w-10")}>
          <button
            className="h-10 flex items-center justify-between px-3 border-b border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setLayerPanelOpen(!layerPanelOpen)}
            data-testid="toggle-layer-panel"
          >
            {layerPanelOpen ? (
              <>
                <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />Layers</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <Layers className="w-4 h-4 mx-auto" />
            )}
          </button>

          {layerPanelOpen && (
            <>
              <div className="flex-1 overflow-y-auto">
                {sortedLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-2 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors group",
                      activeLayerId === layer.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    )}
                    onClick={() => setActiveLayerId(layer.id)}
                    data-testid={`layer-item-${layer.id}`}
                  >
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer.mutate({ projectId, layerId: layer.id, data: { isVisible: !layer.isVisible } });
                        queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) });
                      }}
                      data-testid={`layer-visibility-${layer.id}`}
                    >
                      {layer.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                    </button>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer.mutate({ projectId, layerId: layer.id, data: { isLocked: !layer.isLocked } });
                        queryClient.invalidateQueries({ queryKey: getListLayersQueryKey(projectId) });
                      }}
                      data-testid={`layer-lock-${layer.id}`}
                    >
                      {layer.isLocked ? <Lock className="w-3.5 h-3.5 text-yellow-500" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <span className="flex-1 text-xs truncate">{layer.name}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLayer(layer.id);
                      }}
                      data-testid={`layer-delete-${layer.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1"
                  onClick={addLayer}
                  data-testid="button-add-layer"
                >
                  <Plus className="w-3 h-3" /> Add Layer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="h-36 border-t border-border bg-card flex flex-col shrink-0">
        {/* Timeline controls */}
        <div className="h-9 flex items-center px-3 gap-2 border-b border-border">
          <span className="text-xs text-muted-foreground font-medium">Timeline</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addFrame} data-testid="button-add-frame">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDuplicateFrame} data-testid="button-duplicate-frame">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-destructive"
            onClick={handleDeleteFrame}
            disabled={sortedFrames.length <= 1}
            data-testid="button-delete-frame"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-xs text-muted-foreground">{project?.fps ?? 12} fps</span>
        </div>

        {/* Frame strip */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 py-2 flex items-center gap-1">
          {sortedFrames.map((frame, idx) => (
            <button
              key={frame.id}
              className={cn(
                "flex-shrink-0 flex flex-col items-center gap-1 rounded-md border-2 overflow-hidden transition-all hover:border-primary/50",
                idx === currentFrameIndex
                  ? "border-primary shadow-md shadow-primary/30"
                  : "border-border"
              )}
              style={{ width: 72 }}
              onClick={() => { setIsPlaying(false); setCurrentFrameIndex(idx); }}
              data-testid={`frame-${frame.id}`}
            >
              <div
                className="w-full bg-muted flex items-center justify-center"
                style={{ height: 56, backgroundColor: project?.backgroundColor ?? "#fff" }}
              >
                {frame.thumbnailData ? (
                  <img src={frame.thumbnailData} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">empty</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground pb-0.5 tabular-nums">{idx + 1}</span>
            </button>
          ))}

          <button
            className="flex-shrink-0 w-16 h-16 flex items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            onClick={addFrame}
            data-testid="button-add-frame-inline"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
