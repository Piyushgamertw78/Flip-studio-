import { useState, useRef, useEffect, useCallback } from "react";
  import { useParams, useLocation } from "wouter";
  import {
    ArrowLeft, Play, Pause, SkipBack, SkipForward, Plus, Trash2,
    Eye, EyeOff, Lock, Unlock, Copy, Layers, ChevronDown,
    ZoomIn, ZoomOut, Undo2, Redo2, Download, Grid3X3,
    Pencil, PenLine, Paintbrush, Eraser, PaintBucket, Move,
    Minus, Square, Circle, Triangle, ArrowRight as ArrowTool,
    Type, Pipette, FlipHorizontal2, Settings, Menu, X, Droplets,
  } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Slider } from "@/components/ui/slider";
  import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
  import { Skeleton } from "@/components/ui/skeleton";
  import { Watermark } from "@/components/watermark";
  import { cn } from "@/lib/utils";
  import { useIsMobile } from "@/hooks/use-mobile";
  import { db, type Project, type Frame, type Layer } from "@/lib/local-db";

  type Tool =
    | "pencil" | "pen" | "brush" | "eraser" | "fill" | "move"
    | "line" | "rect" | "ellipse" | "triangle" | "arrow" | "text" | "eyedropper";

  interface Point { x: number; y: number; pressure: number; }
  interface Stroke {
    tool: Tool;
    color: string;
    size: number;
    opacity: number;
    points: Point[];
    text?: string;
    x?: number;
    y?: number;
  }
  interface CanvasData { strokes: Stroke[]; }

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string; key: string }[] = [
    { id: "pencil",     icon: <Pencil className="w-4 h-4" />,      label: "Pencil",      key: "P" },
    { id: "pen",        icon: <PenLine className="w-4 h-4" />,     label: "Pen",         key: "N" },
    { id: "brush",      icon: <Paintbrush className="w-4 h-4" />,  label: "Brush",       key: "B" },
    { id: "eraser",     icon: <Eraser className="w-4 h-4" />,      label: "Eraser",      key: "E" },
    { id: "fill",       icon: <PaintBucket className="w-4 h-4" />, label: "Fill",        key: "F" },
    { id: "eyedropper", icon: <Pipette className="w-4 h-4" />,     label: "Eyedropper",  key: "I" },
    { id: "move",       icon: <Move className="w-4 h-4" />,        label: "Pan",         key: "V" },
    { id: "line",       icon: <Minus className="w-4 h-4" />,       label: "Line",        key: "L" },
    { id: "rect",       icon: <Square className="w-4 h-4" />,      label: "Rectangle",   key: "R" },
    { id: "ellipse",    icon: <Circle className="w-4 h-4" />,      label: "Ellipse",     key: "O" },
    { id: "triangle",   icon: <Triangle className="w-4 h-4" />,    label: "Triangle",    key: "T" },
    { id: "arrow",      icon: <ArrowTool className="w-4 h-4" />,   label: "Arrow",       key: "A" },
    { id: "text",       icon: <Type className="w-4 h-4" />,        label: "Text",        key: "X" },
  ];

  const PRESET_COLORS = [
    "#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e",
    "#3b82f6","#8b5cf6","#ec4899","#06b6d4","#a3a3a3","#78350f",
  ];

  function hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity / 100})`;
  }

  function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
    for (const s of strokes) {
      if (!s.points.length && s.tool !== "text" && s.tool !== "fill") continue;
      ctx.globalAlpha = (s.opacity ?? 100) / 100;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = "source-over";
      }

      if (s.tool === "fill") {
        ctx.fillStyle = s.color;
        ctx.fillRect(0, 0, w, h);
      } else if (s.tool === "text" && s.text && s.x !== undefined && s.y !== undefined) {
        ctx.font = `${s.size * 4}px Inter, sans-serif`;
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, s.x * w, s.y * h);
      } else if (s.tool === "line" && s.points.length >= 2) {
        const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
        ctx.beginPath(); ctx.moveTo(p0.x * w, p0.y * h); ctx.lineTo(p1.x * w, p1.y * h); ctx.stroke();
      } else if (s.tool === "rect" && s.points.length >= 2) {
        const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
        ctx.strokeRect((p0.x * w), (p0.y * h), ((p1.x - p0.x) * w), ((p1.y - p0.y) * h));
      } else if (s.tool === "ellipse" && s.points.length >= 2) {
        const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
        const cx = (p0.x + p1.x) / 2 * w; const cy = (p0.y + p1.y) / 2 * h;
        const rx = Math.abs(p1.x - p0.x) / 2 * w; const ry = Math.abs(p1.y - p0.y) / 2 * h;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (s.tool === "triangle" && s.points.length >= 2) {
        const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
        ctx.beginPath();
        ctx.moveTo((p0.x + p1.x) / 2 * w, p0.y * h);
        ctx.lineTo(p0.x * w, p1.y * h);
        ctx.lineTo(p1.x * w, p1.y * h);
        ctx.closePath(); ctx.stroke();
      } else if (s.tool === "arrow" && s.points.length >= 2) {
        const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
        const sx = p0.x * w, sy = p0.y * h, ex = p1.x * w, ey = p1.y * h;
        const angle = Math.atan2(ey - sy, ex - sx);
        const hw = s.size * 4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - hw * Math.cos(angle - Math.PI / 6), ey - hw * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex - hw * Math.cos(angle + Math.PI / 6), ey - hw * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      } else if (["pencil", "pen", "brush"].includes(s.tool) && s.points.length > 0) {
        ctx.lineWidth = s.tool === "brush" ? s.size * 2 : s.size;
        ctx.beginPath();
        ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
        for (let i = 1; i < s.points.length; i++) {
          const prev = s.points[i - 1]!; const curr = s.points[i]!;
          const mx = (prev.x + curr.x) / 2 * w; const my = (prev.y + curr.y) / 2 * h;
          ctx.quadraticCurveTo(prev.x * w, prev.y * h, mx, my);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  export default function Studio() {
    const { id } = useParams<{ id: string }>();
    const projectId = Number(id);
    const [, setLocation] = useLocation();
    const isMobile = useIsMobile();

    const [project, setProject] = useState<Project | null>(null);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    const [currentLayerId, setCurrentLayerId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Tool state
    const [tool, setTool] = useState<Tool>("pencil");
    const [color, setColor] = useState("#000000");
    const [size, setSize] = useState(4);
    const [opacity, setOpacity] = useState(100);
    const [zoom, setZoom] = useState(1);

    // FlipaClip features
    const [onionSkinning, setOnionSkinning] = useState(true);
    const [onionPrev, setOnionPrev] = useState(2);
    const [onionNext, setOnionNext] = useState(0);
    const [showGrid, setShowGrid] = useState(false);
    const [gridSize, setGridSize] = useState(40);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showLayers, setShowLayers] = useState(!isMobile);
    const [showTimeline, setShowTimeline] = useState(true);
    const [showColorPanel, setShowColorPanel] = useState(false);
    const [symmetryMode, setSymmetryMode] = useState(false);
    const [lightTable, setLightTable] = useState(false);

    // Canvas state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const currentStroke = useRef<Stroke | null>(null);
    const undoStack = useRef<Stroke[][]>([]);
    const redoStack = useRef<Stroke[][]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const strokesRef = useRef<Stroke[]>([]);
    const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load project data
    useEffect(() => {
      const load = async () => {
        const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
        if (!proj) { setLocation("/"); return; }
        setProject(proj);
        setFrames(fs);
        if (fs.length > 0) {
          const ls = await db.layers.listByFrame(fs[0]!.id);
          setLayers(ls);
          setCurrentLayerId(ls[0]?.id ?? null);
          const data: CanvasData = safeParseCanvas(fs[0]!.canvasData);
          setStrokes(data.strokes);
          strokesRef.current = data.strokes;
        }
        setLoading(false);
      };
      void load();
    }, [projectId]);

    const safeParseCanvas = (raw: string): CanvasData => {
      try { const d = JSON.parse(raw); return { strokes: Array.isArray(d.strokes) ? d.strokes : [] }; }
      catch { return { strokes: [] }; }
    };

    const currentFrame = frames[currentFrameIdx];

    // Switch frames
    const switchFrame = useCallback(async (idx: number) => {
      if (!currentFrame) return;
      // Save current
      const data = JSON.stringify({ strokes: strokesRef.current });
      await db.frames.update(currentFrame.id, { canvasData: data });
      const nextFrame = frames[idx];
      if (!nextFrame) return;
      const ls = await db.layers.listByFrame(nextFrame.id);
      setLayers(ls);
      setCurrentLayerId(ls[0]?.id ?? null);
      const d = safeParseCanvas(nextFrame.canvasData);
      setStrokes(d.strokes);
      strokesRef.current = d.strokes;
      undoStack.current = [];
      redoStack.current = [];
      setCurrentFrameIdx(idx);
    }, [currentFrame, frames]);

    // Auto-save
    const scheduleAutoSave = useCallback(() => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        if (!currentFrame) return;
        const data = JSON.stringify({ strokes: strokesRef.current });
        await db.frames.update(currentFrame.id, { canvasData: data });
        // Generate thumbnail
        const canvas = canvasRef.current;
        if (canvas) {
          const thumb = canvas.toDataURL("image/jpeg", 0.4);
          await db.frames.update(currentFrame.id, { thumbnail: thumb });
          await db.projects.update(projectId, { thumbnail: thumb });
          setFrames(prev => prev.map((f, i) => i === currentFrameIdx ? { ...f, thumbnail: thumb, canvasData: data } : f));
        }
      }, 800);
    }, [currentFrame, currentFrameIdx, projectId]);

    // Draw canvas
    const drawAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !project) return;
      const ctx = canvas.getContext("2d")!;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = project.backgroundColor;
      ctx.fillRect(0, 0, w, h);

      // Onion skinning — previous frames
      if (onionSkinning) {
        const colors = ["#ff000040", "#ff000020"];
        for (let i = 1; i <= onionPrev; i++) {
          const prevFrame = frames[currentFrameIdx - i];
          if (!prevFrame) continue;
          const prevCtx = document.createElement("canvas");
          prevCtx.width = w; prevCtx.height = h;
          const pc = prevCtx.getContext("2d")!;
          const pd = safeParseCanvas(prevFrame.canvasData);
          renderStrokes(pc, pd.strokes, w, h);
          ctx.globalAlpha = 0.35 / i;
          ctx.drawImage(prevCtx, 0, 0);
        }
        // Next frames
        for (let i = 1; i <= onionNext; i++) {
          const nextFrame = frames[currentFrameIdx + i];
          if (!nextFrame) continue;
          const nextCtx = document.createElement("canvas");
          nextCtx.width = w; nextCtx.height = h;
          const nc = nextCtx.getContext("2d")!;
          const nd = safeParseCanvas(nextFrame.canvasData);
          renderStrokes(nc, nd.strokes, w, h);
          ctx.globalAlpha = 0.2 / i;
          ctx.drawImage(nextCtx, 0, 0);
        }
        ctx.globalAlpha = 1;
      }

      // Current strokes
      renderStrokes(ctx, strokesRef.current, w, h);

      // Grid
      if (showGrid) {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        for (let x = gridSize; x < w; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = gridSize; y < h; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Symmetry line
      if (symmetryMode) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }, [project, frames, currentFrameIdx, onionSkinning, onionPrev, onionNext, showGrid, gridSize, symmetryMode]);

    useEffect(() => { drawAll(); }, [drawAll, strokes]);

    // Playback
    useEffect(() => {
      if (isPlaying && frames.length > 1) {
        const fps = project?.fps ?? 12;
        playIntervalRef.current = setInterval(() => {
          setCurrentFrameIdx(prev => {
            const next = (prev + 1) % frames.length;
            const frame = frames[next];
            if (frame) {
              const d = safeParseCanvas(frame.canvasData);
              strokesRef.current = d.strokes;
              setStrokes(d.strokes);
            }
            return next;
          });
        }, 1000 / fps);
      } else {
        if (playIntervalRef.current) { clearInterval(playIntervalRef.current); playIntervalRef.current = null; }
      }
      return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
    }, [isPlaying, frames, project?.fps]);

    // Keyboard shortcuts
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const k = e.key.toUpperCase();
        if (k === " ") { e.preventDefault(); setIsPlaying(p => !p); return; }
        if (e.ctrlKey || e.metaKey) {
          if (k === "Z") { e.preventDefault(); handleUndo(); return; }
          if (k === "Y") { e.preventDefault(); handleRedo(); return; }
        }
        const found = TOOLS.find(t => t.key === k);
        if (found) setTool(found.id);
        if (k === "ARROWLEFT") switchFrame(Math.max(0, currentFrameIdx - 1));
        if (k === "ARROWRIGHT") switchFrame(Math.min(frames.length - 1, currentFrameIdx + 1));
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [currentFrameIdx, frames.length, switchFrame]);

    const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number; pressure: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      let clientX: number, clientY: number, pressure = 0.5;
      if ("touches" in e) {
        clientX = e.touches[0]!.clientX;
        clientY = e.touches[0]!.clientY;
        if ("force" in e.touches[0]!) pressure = (e.touches[0] as Touch & { force: number }).force || 0.5;
      } else {
        clientX = e.clientX; clientY = e.clientY;
      }
      return {
        x: ((clientX - rect.left) * scaleX) / canvas.width,
        y: ((clientY - rect.top) * scaleY) / canvas.height,
        pressure,
      };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
      if (isPlaying || tool === "move") return;
      e.preventDefault();
      const pos = getPos(e);

      if (tool === "eyedropper") {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const px = Math.floor(pos.x * canvas.width);
        const py = Math.floor(pos.y * canvas.height);
        const d = ctx.getImageData(px, py, 1, 1).data;
        const hex = "#" + [d[0]!, d[1]!, d[2]!].map(v => v.toString(16).padStart(2, "0")).join("");
        setColor(hex);
        return;
      }

      if (tool === "fill") {
        const newStroke: Stroke = { tool: "fill", color, size, opacity, points: [pos] };
        undoStack.current.push([...strokesRef.current]);
        redoStack.current = [];
        strokesRef.current = [...strokesRef.current, newStroke];
        setStrokes([...strokesRef.current]);
        scheduleAutoSave();
        return;
      }

      isDrawing.current = true;
      currentStroke.current = { tool, color, size, opacity, points: [pos] };
    };

    const continueDraw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing.current || !currentStroke.current) return;
      e.preventDefault();
      const pos = getPos(e);
      currentStroke.current.points.push(pos);

      // Symmetry
      if (symmetryMode) {
        const mirrorX = 1 - pos.x;
        currentStroke.current.points.push({ x: mirrorX, y: pos.y, pressure: pos.pressure });
      }

      // Draw preview on overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d")!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        renderStrokes(ctx, [currentStroke.current], overlay.width, overlay.height);
      }
    };

    const endDraw = () => {
      if (!isDrawing.current || !currentStroke.current) return;
      isDrawing.current = false;
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      strokesRef.current = [...strokesRef.current, currentStroke.current];
      setStrokes([...strokesRef.current]);
      currentStroke.current = null;
      const overlay = overlayRef.current;
      if (overlay) overlay.getContext("2d")!.clearRect(0, 0, overlay.width, overlay.height);
      scheduleAutoSave();
    };

    const handleUndo = () => {
      if (!undoStack.current.length) return;
      redoStack.current.push([...strokesRef.current]);
      strokesRef.current = undoStack.current.pop()!;
      setStrokes([...strokesRef.current]);
      scheduleAutoSave();
    };

    const handleRedo = () => {
      if (!redoStack.current.length) return;
      undoStack.current.push([...strokesRef.current]);
      strokesRef.current = redoStack.current.pop()!;
      setStrokes([...strokesRef.current]);
      scheduleAutoSave();
    };

    const handleClearFrame = () => {
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      strokesRef.current = [];
      setStrokes([]);
      scheduleAutoSave();
    };

    const handleFlipH = () => {
      const flipped = strokesRef.current.map(s => ({
        ...s,
        points: s.points.map(p => ({ ...p, x: 1 - p.x })),
        x: s.x !== undefined ? 1 - s.x : undefined,
      }));
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      strokesRef.current = flipped;
      setStrokes(flipped);
      scheduleAutoSave();
    };

    const handleFlipV = () => {
      const flipped = strokesRef.current.map(s => ({
        ...s,
        points: s.points.map(p => ({ ...p, y: 1 - p.y })),
        y: s.y !== undefined ? 1 - s.y : undefined,
      }));
      undoStack.current.push([...strokesRef.current]);
      redoStack.current = [];
      strokesRef.current = flipped;
      setStrokes(flipped);
      scheduleAutoSave();
    };

    const addFrame = async () => {
      if (!currentFrame) return;
      const now = new Date().toISOString();
      const newFrameId = await db.frames.create({
        projectId,
        order: frames.length,
        duration: Math.round(1000 / (project?.fps ?? 12)),
        canvasData: "{}",
        thumbnail: "",
        createdAt: now,
      });
      await db.layers.create({ frameId: newFrameId, projectId, name: "Layer 1", order: 0, visible: true, locked: false, opacity: 100, blendMode: "normal", canvasData: "{}", createdAt: now });
      const newFrames = await db.frames.listByProject(projectId);
      setFrames(newFrames);
      await switchFrame(newFrames.findIndex(f => f.id === newFrameId));
    };

    const deleteFrame = async (idx: number) => {
      if (frames.length <= 1) return;
      const frame = frames[idx];
      if (!frame) return;
      await db.frames.delete(frame.id);
      const newFrames = await db.frames.listByProject(projectId);
      setFrames(newFrames);
      const newIdx = Math.min(idx, newFrames.length - 1);
      await switchFrame(newIdx);
    };

    const duplicateFrame = async (idx: number) => {
      const frame = frames[idx];
      if (!frame) return;
      // Save current first
      const data = JSON.stringify({ strokes: strokesRef.current });
      await db.frames.update(frame.id, { canvasData: data });
      await db.frames.duplicate(frame.id);
      const newFrames = await db.frames.listByProject(projectId);
      setFrames(newFrames);
    };

    const addLayer = async () => {
      if (!currentFrame) return;
      const now = new Date().toISOString();
      const newLayerId = await db.layers.create({
        frameId: currentFrame.id, projectId, name: `Layer ${layers.length + 1}`,
        order: layers.length, visible: true, locked: false, opacity: 100, blendMode: "normal", canvasData: "{}", createdAt: now,
      });
      const ls = await db.layers.listByFrame(currentFrame.id);
      setLayers(ls);
      setCurrentLayerId(newLayerId);
    };

    const toggleLayerVisibility = async (layerId: number, visible: boolean) => {
      await db.layers.update(layerId, { visible });
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible } : l));
    };

    const toggleLayerLock = async (layerId: number, locked: boolean) => {
      await db.layers.update(layerId, { locked });
      setLayers(prev => prev.map(l => l.id === layerId ? { ...l, locked } : l));
    };

    const deleteLayer = async (layerId: number) => {
      if (layers.length <= 1) return;
      await db.layers.delete(layerId);
      const ls = await db.layers.listByFrame(currentFrame?.id ?? 0);
      setLayers(ls);
      if (currentLayerId === layerId) setCurrentLayerId(ls[0]?.id ?? null);
    };

    if (loading) return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#050508]">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );

    if (!project) return null;

    const canvasW = project.width;
    const canvasH = project.height;

    return (
      <div className="h-screen w-screen bg-[#0a0a0f] flex flex-col overflow-hidden text-white select-none">
        {/* Top bar */}
        <div className="h-12 border-b border-white/10 bg-[#111118] flex items-center px-3 gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold truncate max-w-32 md:max-w-48">{project.name}</span>

          <div className="flex-1" />

          {/* Playback */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => switchFrame(0)}>
                  <SkipBack className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>First Frame</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => switchFrame(Math.max(0, currentFrameIdx - 1))}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous Frame (←)</TooltipContent>
            </Tooltip>
            <Button
              size="icon"
              className="h-8 w-8 bg-violet-600 hover:bg-violet-500 text-white border-0"
              onClick={() => setIsPlaying(p => !p)}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => switchFrame(Math.min(frames.length - 1, currentFrameIdx + 1))}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next Frame (→)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => switchFrame(frames.length - 1)}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Last Frame</TooltipContent>
            </Tooltip>
            <span className="text-xs text-white/40 tabular-nums min-w-12 text-center">{currentFrameIdx + 1}/{frames.length}</span>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={handleUndo}>
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={handleRedo}>
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-white/5", onionSkinning ? "text-fuchsia-400" : "text-white/40")} onClick={() => setOnionSkinning(p => !p)}>
                  <Droplets className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Onion Skinning</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-white/5", showGrid ? "text-cyan-400" : "text-white/40")} onClick={() => setShowGrid(p => !p)}>
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Grid</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-white/5", symmetryMode ? "text-yellow-400" : "text-white/40")} onClick={() => setSymmetryMode(p => !p)}>
                  <FlipHorizontal2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Symmetry Mode</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/5" onClick={() => setLocation(`/projects/${projectId}/export`)}>
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-white/5", showLayers ? "text-violet-400" : "text-white/40")} onClick={() => setShowLayers(p => !p)}>
                  <Layers className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Layers Panel</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left toolbar */}
          <div className="w-12 bg-[#111118] border-r border-white/10 flex flex-col items-center py-2 gap-1 overflow-y-auto shrink-0">
            {TOOLS.map(t => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                      tool === t.id ? "bg-violet-600 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() => setTool(t.id)}
                  >
                    {t.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t.label} ({t.key})</TooltipContent>
              </Tooltip>
            ))}

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Color swatch */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg border-2 border-white/20 hover:border-violet-500 transition-colors relative"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPanel(p => !p)}
                />
              </TooltipTrigger>
              <TooltipContent side="right">Color</TooltipContent>
            </Tooltip>

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Flip H */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center" onClick={handleFlipH}>
                  <FlipHorizontal2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Flip Horizontal</TooltipContent>
            </Tooltip>

            {/* Clear */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-9 h-9 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center" onClick={handleClearFrame}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Clear Frame</TooltipContent>
            </Tooltip>
          </div>

          {/* Color panel (popup) */}
          {showColorPanel && (
            <div className="absolute left-14 top-1/3 z-30 bg-[#1a1a24] border border-white/10 rounded-xl p-3 shadow-2xl w-44">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent mb-2" />
              <div className="grid grid-cols-6 gap-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} className={cn("w-6 h-6 rounded-md border-2 transition-transform hover:scale-110", color === c ? "border-violet-400" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
              </div>
              <div className="mt-2">
                <p className="text-xs text-white/40 mb-1">Brush Size: {size}px</p>
                <Slider value={[size]} min={1} max={50} step={1} onValueChange={([v]) => setSize(v!)} className="[&_[role=slider]]:bg-violet-500" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-white/40 mb-1">Opacity: {opacity}%</p>
                <Slider value={[opacity]} min={1} max={100} step={1} onValueChange={([v]) => setOpacity(v!)} className="[&_[role=slider]]:bg-violet-500" />
              </div>
            </div>
          )}

          {/* Canvas area */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#1a1a22] flex items-center justify-center" onClick={() => setShowColorPanel(false)}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s" }} className="relative shadow-2xl shadow-black/50">
              <canvas
                ref={canvasRef}
                width={canvasW}
                height={canvasH}
                className="block"
                style={{ width: "min(calc(100vw - 200px), calc(100vh - 200px))", height: "auto", imageRendering: "pixelated", cursor: tool === "move" ? "grab" : tool === "eyedropper" ? "crosshair" : "crosshair" }}
                onMouseDown={startDraw}
                onMouseMove={continueDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={continueDraw}
                onTouchEnd={endDraw}
              />
              <canvas
                ref={overlayRef}
                width={canvasW}
                height={canvasH}
                className="absolute inset-0 pointer-events-none"
                style={{ width: "min(calc(100vw - 200px), calc(100vh - 200px))", height: "auto" }}
              />
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-[#111118]/90 backdrop-blur-sm rounded-lg p-1 border border-white/10">
              <button className="w-7 h-7 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button className="text-xs text-white/60 w-10 text-center hover:text-white transition-colors" onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}%
              </button>
              <button className="w-7 h-7 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right: layers panel */}
          {showLayers && (
            <div className="w-52 bg-[#111118] border-l border-white/10 flex flex-col shrink-0">
              <div className="h-10 border-b border-white/10 flex items-center px-3 justify-between">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Layers</span>
                <button className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10" onClick={addLayer}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                {[...layers].reverse().map(layer => (
                  <div
                    key={layer.id}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm group",
                      currentLayerId === layer.id ? "bg-violet-600/20 border border-violet-500/30" : "hover:bg-white/5 border border-transparent"
                    )}
                    onClick={() => setCurrentLayerId(layer.id)}
                  >
                    <div className="w-6 h-6 rounded bg-white/10 border border-white/10 shrink-0" />
                    <span className="flex-1 text-xs truncate text-white/80">{layer.name}</span>
                    <button className="text-white/30 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-all" onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id, !layer.visible); }}>
                      {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button className="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" onClick={e => { e.stopPropagation(); void deleteLayer(layer.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom timeline */}
        {showTimeline && (
          <div className="h-24 bg-[#111118] border-t border-white/10 flex flex-col shrink-0">
            <div className="h-8 border-b border-white/10 flex items-center px-3 gap-2">
              <span className="text-xs text-white/40 font-medium">Timeline</span>
              <span className="text-xs text-white/30">·</span>
              <span className="text-xs text-white/40">{project.fps} fps</span>
              <span className="text-xs text-white/30">·</span>
              <span className="text-xs text-white/40">{frames.length} frames</span>
              <div className="flex-1" />
              <button className="h-6 px-2 rounded text-xs bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 transition-colors flex items-center gap-1" onClick={addFrame}>
                <Plus className="w-3 h-3" /> Add Frame
              </button>
            </div>
            <div className="flex-1 flex items-center gap-1.5 px-3 overflow-x-auto">
              {frames.map((frame, idx) => (
                <div
                  key={frame.id}
                  className={cn(
                    "relative shrink-0 w-14 h-12 rounded-lg border-2 cursor-pointer overflow-hidden transition-all group",
                    currentFrameIdx === idx ? "border-violet-500 ring-1 ring-violet-500/50" : "border-white/10 hover:border-white/30"
                  )}
                  onClick={() => !isPlaying && switchFrame(idx)}
                >
                  {frame.thumbnail ? (
                    <img src={frame.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <span className="text-white/20 text-xs">{idx + 1}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                    <button className="w-5 h-5 rounded flex items-center justify-center text-white hover:bg-white/20 transition-colors" onClick={e => { e.stopPropagation(); void duplicateFrame(idx); }}>
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                    <button className="w-5 h-5 rounded flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors" onClick={e => { e.stopPropagation(); void deleteFrame(idx); }}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {currentFrameIdx === idx && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Watermark />
      </div>
    );
  }

  // Need this for the ArrowRight import
  function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    );
  }
  