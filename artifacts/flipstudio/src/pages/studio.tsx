import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Plus, Trash2,
  Eye, EyeOff, Lock, Unlock, Copy, Layers, ChevronUp, ChevronDown,
  ZoomIn, ZoomOut, Undo2, Redo2, Download, Grid3X3,
  Pencil, PenLine, Paintbrush, Eraser, PaintBucket, Move,
  Minus, Square, Circle, Triangle, Type, Pipette,
  FlipHorizontal2, Droplets, X, Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorWheel } from "@/components/color-wheel";
import { Watermark } from "@/components/watermark";
import { cn } from "@/lib/utils";
import { db, type Project, type Frame, type Layer } from "@/lib/local-db";

type Tool =
  | "pencil" | "pen" | "brush" | "eraser" | "fill" | "move"
  | "line" | "rect" | "ellipse" | "triangle" | "arrow" | "text" | "eyedropper";

interface Point { x: number; y: number; pressure: number }
interface Stroke {
  tool: Tool; color: string; size: number; opacity: number;
  points: Point[];
  text?: string; textX?: number; textY?: number;
}
interface CanvasData { strokes: Stroke[] }

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: "pencil",     icon: <Pencil className="w-5 h-5" />,      label: "Pencil",      shortcut: "P" },
  { id: "pen",        icon: <PenLine className="w-5 h-5" />,     label: "Ink Pen",     shortcut: "N" },
  { id: "brush",      icon: <Paintbrush className="w-5 h-5" />,  label: "Brush",       shortcut: "B" },
  { id: "eraser",     icon: <Eraser className="w-5 h-5" />,      label: "Eraser",      shortcut: "E" },
  { id: "fill",       icon: <PaintBucket className="w-5 h-5" />, label: "Fill",        shortcut: "F" },
  { id: "eyedropper", icon: <Pipette className="w-5 h-5" />,     label: "Eyedropper",  shortcut: "I" },
  { id: "move",       icon: <Move className="w-5 h-5" />,        label: "Pan",         shortcut: "V" },
  { id: "line",       icon: <Minus className="w-5 h-5" />,       label: "Line",        shortcut: "L" },
  { id: "rect",       icon: <Square className="w-5 h-5" />,      label: "Rectangle",   shortcut: "R" },
  { id: "ellipse",    icon: <Circle className="w-5 h-5" />,      label: "Ellipse",     shortcut: "O" },
  { id: "triangle",   icon: <Triangle className="w-5 h-5" />,    label: "Triangle",    shortcut: "T" },
  { id: "text",       icon: <Type className="w-5 h-5" />,        label: "Text",        shortcut: "X" },
];

function FlipVIcon() {
  return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8H3"/><path d="m15 3-5 5-5-5"/><path d="m15 21-5-5-5 5"/></svg>;
}

function safeParseCanvas(raw: string): CanvasData {
  try { const d = JSON.parse(raw) as CanvasData; return { strokes: Array.isArray(d.strokes) ? d.strokes : [] }; }
  catch { return { strokes: [] }; }
}

function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  for (const s of strokes) {
    ctx.globalAlpha = (s.opacity ?? 100) / 100;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
    if (s.tool === "eraser") ctx.globalAlpha = 1;

    if (s.tool === "fill") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = s.color;
      ctx.fillRect(0, 0, w, h);
    } else if (s.tool === "text" && s.text && s.textX !== undefined && s.textY !== undefined) {
      ctx.globalCompositeOperation = "source-over";
      ctx.font = (s.size * 5) + "px Inter, sans-serif";
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.textX * w, s.textY * h);
    } else if (!s.points.length) {
      // skip
    } else if (s.tool === "line" && s.points.length >= 2) {
      const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
      ctx.beginPath(); ctx.moveTo(p0.x * w, p0.y * h); ctx.lineTo(p1.x * w, p1.y * h); ctx.stroke();
    } else if (s.tool === "rect" && s.points.length >= 2) {
      const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
      ctx.strokeRect(p0.x * w, p0.y * h, (p1.x - p0.x) * w, (p1.y - p0.y) * h);
    } else if (s.tool === "ellipse" && s.points.length >= 2) {
      const p0 = s.points[0]!; const p1 = s.points[s.points.length - 1]!;
      const cx = (p0.x + p1.x) / 2 * w; const cy = (p0.y + p1.y) / 2 * h;
      const rx = Math.abs(p1.x - p0.x) / 2 * w; const ry = Math.abs(p1.y - p0.y) / 2 * h;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1,rx), Math.max(1,ry), 0, 0, Math.PI * 2); ctx.stroke();
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
      ctx.lineWidth = s.tool === "brush" ? s.size * 2.5 : s.size;
      if (s.tool === "brush") { ctx.globalAlpha = (s.opacity / 100) * 0.6; }
      ctx.beginPath(); ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1]!; const curr = s.points[i]!;
        ctx.quadraticCurveTo(prev.x * w, prev.y * h, (prev.x + curr.x) / 2 * w, (prev.y + curr.y) / 2 * h);
      }
      const last = s.points[s.points.length - 1]!;
      ctx.lineTo(last.x * w, last.y * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

function compositeAllLayers(targetCtx: CanvasRenderingContext2D, layers: Layer[], layerStrokes: Map<number, Stroke[]>, w: number, h: number, bgColor: string) {
  targetCtx.clearRect(0, 0, w, h);
  targetCtx.fillStyle = bgColor;
  targetCtx.fillRect(0, 0, w, h);
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  for (const layer of sorted) {
    if (!layer.visible) continue;
    const strokes = layerStrokes.get(layer.id) ?? [];
    if (!strokes.length) continue;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    renderStrokes(tmp.getContext("2d")!, strokes, w, h);
    targetCtx.globalAlpha = layer.opacity / 100;
    targetCtx.drawImage(tmp, 0, 0);
    targetCtx.globalAlpha = 1;
  }
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

  // Per-layer strokes: key = layerId
  const layerStrokes = useRef<Map<number, Stroke[]>>(new Map());
  const undoStack    = useRef<Map<number, Stroke[]>[]>([]);
  const redoStack    = useRef<Map<number, Stroke[]>[]>([]);

  const [tool, setTool]       = useState<Tool>("pencil");
  const [color, setColor]     = useState("#000000");
  const [size, setSize]       = useState(4);
  const [opacity, setOpacity] = useState(100);
  const [zoom, setZoom]       = useState(1);

  const [onionSkinning, setOnionSkinning] = useState(true);
  const [onionPrev, ]                    = useState(2);
  const [showGrid, setShowGrid]          = useState(false);
  const [symmetryMode, setSymmetryMode]  = useState(false);
  const [isPlaying, setIsPlaying]        = useState(false);
  const [loopPlay, setLoopPlay]          = useState(true);

  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showColorPanel, setShowColorPanel]   = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const curStroke  = useRef<Stroke | null>(null);
  const playTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panOffset, setPanOffset] = useState({x:0,y:0});
  const panStart   = useRef<{x:number;y:number;ox:number;oy:number}|null>(null);

  useEffect(() => {
    const load = async () => {
      const [proj, fs] = await Promise.all([db.projects.get(projectId), db.frames.listByProject(projectId)]);
      if (!proj) { setLocation("/"); return; }
      setProject(proj);
      setFrames(fs);
      if (fs.length > 0) {
        const ls = await db.layers.listByFrame(fs[0]!.id);
        setLayers(ls);
        const map = new Map<number,Stroke[]>();
        for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
        layerStrokes.current = map;
        setCurrentLayerId(ls[0]?.id ?? null);
      }
      setLoading(false);
    };
    void load();
  }, [projectId]);

  const currentFrame   = frames[currentFrameIdx];
  const currentLayer   = layers.find(l => l.id === currentLayerId);
  const sortedLayers   = [...layers].sort((a,b) => b.order - a.order);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    // Onion skinning
    if (onionSkinning) {
      for (let i = 1; i <= onionPrev; i++) {
        const pf = frames[currentFrameIdx - i];
        if (!pf) continue;
        const data = safeParseCanvas(pf.canvasData);
        if (!data.strokes.length) continue;
        const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
        renderStrokes(tmp.getContext("2d")!, data.strokes, w, h);
        ctx.globalAlpha = 0.3 / i;
        ctx.drawImage(tmp, 0, 0);
        ctx.globalAlpha = 1;
      }
    }

    compositeAllLayers(ctx, layers, layerStrokes.current, w, h, project.backgroundColor);

    if (showGrid) {
      ctx.save();
      ctx.globalAlpha = 0.12; ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1;
      for (let x = 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for (let y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      ctx.restore();
    }
    if (symmetryMode) {
      ctx.save();
      ctx.globalAlpha = 0.35; ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 1;
      ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }, [project, layers, frames, currentFrameIdx, onionSkinning, onionPrev, showGrid, symmetryMode]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      playTimer.current = setInterval(() => {
        setCurrentFrameIdx(prev => {
          let next = prev + 1;
          if (next >= frames.length) { if (loopPlay) next = 0; else { setIsPlaying(false); return prev; } }
          const frame = frames[next];
          if (frame) {
            void db.layers.listByFrame(frame.id).then(ls => {
              const map = new Map<number,Stroke[]>();
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
  }, [isPlaying, frames, project?.fps, loopPlay]);

  const saveCurrentLayerData = async () => {
    if (!currentFrame) return;
    for (const layer of layers) {
      const strokes = layerStrokes.current.get(layer.id) ?? [];
      await db.layers.update(layer.id, { canvasData: JSON.stringify({ strokes }) });
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const thumb = canvas.toDataURL("image/jpeg", 0.4);
      await db.frames.update(currentFrame.id, { thumbnail: thumb });
      await db.projects.update(projectId, { thumbnail: thumb });
      setFrames(prev => prev.map((f,i) => i===currentFrameIdx ? {...f,thumbnail:thumb} : f));
    }
  };

  const scheduleAutoSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveCurrentLayerData(); }, 1000);
  };

  const switchFrame = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= frames.length || idx === currentFrameIdx) return;
    await saveCurrentLayerData();
    const frame = frames[idx];
    if (!frame) return;
    const ls = await db.layers.listByFrame(frame.id);
    const map = new Map<number,Stroke[]>();
    for (const l of ls) map.set(l.id, safeParseCanvas(l.canvasData).strokes);
    layerStrokes.current = map;
    setLayers(ls);
    setCurrentLayerId(ls[0]?.id ?? null);
    undoStack.current = []; redoStack.current = [];
    setCurrentFrameIdx(idx);
  }, [currentFrameIdx, frames]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number, pressure = 0.5;
    if ("touches" in e) {
      clientX = e.touches[0]!.clientX; clientY = e.touches[0]!.clientY;
      pressure = (e.touches[0] as Touch & { force?: number }).force || 0.5;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
      pressure,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPlaying) return;
    e.preventDefault();
    setShowColorPanel(false);

    if (tool === "move") {
      const touch = "touches" in e ? e.touches[0]! : e as React.MouseEvent;
      panStart.current = { x: touch.clientX, y: touch.clientY, ox: panOffset.x, oy: panOffset.y };
      return;
    }
    const pos = getPos(e);
    if (currentLayer?.locked) return;

    if (tool === "eyedropper") {
      const ctx = canvasRef.current!.getContext("2d")!;
      const c = canvasRef.current!;
      const px = Math.floor(pos.x * c.width); const py = Math.floor(pos.y * c.height);
      const d = ctx.getImageData(Math.max(0,px), Math.max(0,py), 1, 1).data;
      setColor("#" + [d[0]!,d[1]!,d[2]!].map(v=>v.toString(16).padStart(2,"0")).join(""));
      return;
    }
    if (tool === "fill") {
      if (!currentLayerId) return;
      const prev = new Map(layerStrokes.current);
      undoStack.current.push(prev); redoStack.current = [];
      const cur = [...(layerStrokes.current.get(currentLayerId) ?? []), { tool:"fill" as Tool, color, size, opacity, points:[pos] }];
      layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, cur);
      redraw(); scheduleAutoSave(); return;
    }
    isDrawing.current = true;
    curStroke.current = { tool, color, size, opacity, points: [pos] };
  };

  const continueDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "move" && panStart.current) {
      const touch = "touches" in e ? e.touches[0]! : e as React.MouseEvent;
      setPanOffset({ x: panStart.current.ox + (touch.clientX - panStart.current.x), y: panStart.current.oy + (touch.clientY - panStart.current.y) });
      return;
    }
    if (!isDrawing.current || !curStroke.current) return;
    e.preventDefault();
    const pos = getPos(e);
    curStroke.current.points.push(pos);
    if (symmetryMode) curStroke.current.points.push({ x: 1 - pos.x, y: pos.y, pressure: pos.pressure });
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d")!;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      renderStrokes(ctx, [curStroke.current], overlay.width, overlay.height);
    }
  };

  const endDraw = () => {
    panStart.current = null;
    if (!isDrawing.current || !curStroke.current || !currentLayerId) return;
    isDrawing.current = false;
    const prev = new Map(layerStrokes.current);
    undoStack.current.push(prev); redoStack.current = [];
    const cur = [...(layerStrokes.current.get(currentLayerId) ?? []), curStroke.current];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, cur);
    curStroke.current = null;
    const overlay = overlayRef.current;
    if (overlay) overlay.getContext("2d")!.clearRect(0, 0, overlay.width, overlay.height);
    redraw(); scheduleAutoSave();
  };

  const handleUndo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(new Map(layerStrokes.current));
    layerStrokes.current = undoStack.current.pop()!;
    redraw(); scheduleAutoSave();
  }, [redraw]);

  const handleRedo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(new Map(layerStrokes.current));
    layerStrokes.current = redoStack.current.pop()!;
    redraw(); scheduleAutoSave();
  }, [redraw]);

  const clearCurrentLayer = () => {
    if (!currentLayerId) return;
    undoStack.current.push(new Map(layerStrokes.current)); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, []);
    redraw(); scheduleAutoSave();
  };

  const flipH = () => {
    if (!currentLayerId) return;
    const strokes = (layerStrokes.current.get(currentLayerId) ?? []).map(s => ({ ...s, points: s.points.map(p => ({ ...p, x: 1 - p.x })) }));
    undoStack.current.push(new Map(layerStrokes.current)); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, strokes);
    redraw(); scheduleAutoSave();
  };

  const flipV = () => {
    if (!currentLayerId) return;
    const strokes = (layerStrokes.current.get(currentLayerId) ?? []).map(s => ({ ...s, points: s.points.map(p => ({ ...p, y: 1 - p.y })) }));
    undoStack.current.push(new Map(layerStrokes.current)); redoStack.current = [];
    layerStrokes.current = new Map(layerStrokes.current).set(currentLayerId, strokes);
    redraw(); scheduleAutoSave();
  };

  const addFrame = async () => {
    if (!currentFrame) return;
    await saveCurrentLayerData();
    const now = new Date().toISOString();
    const newFId = await db.frames.create({ projectId, order: frames.length, duration: Math.round(1000/(project?.fps??12)), canvasData:"{}", thumbnail:"", createdAt:now });
    const newLId = await db.layers.create({ frameId:newFId, projectId, name:"Layer 1", order:0, visible:true, locked:false, opacity:100, blendMode:"normal", canvasData:'{"strokes":[]}', createdAt:now });
    const newFrames = await db.frames.listByProject(projectId);
    setFrames(newFrames);
    layerStrokes.current = new Map([[newLId, []]]);
    const ls = await db.layers.listByFrame(newFId);
    setLayers(ls); setCurrentLayerId(newLId);
    undoStack.current = []; redoStack.current = [];
    const newIdx = newFrames.findIndex(f => f.id === newFId);
    setCurrentFrameIdx(newIdx >= 0 ? newIdx : newFrames.length - 1);
  };

  const duplicateFrame = async (idx: number) => {
    await saveCurrentLayerData();
    const frame = frames[idx]; if (!frame) return;
    await db.frames.duplicate(frame.id);
    setFrames(await db.frames.listByProject(projectId));
  };

  const deleteFrame = async (idx: number) => {
    if (frames.length <= 1) return;
    const frame = frames[idx]; if (!frame) return;
    await db.frames.delete(frame.id);
    const newFrames = await db.frames.listByProject(projectId);
    setFrames(newFrames);
    await switchFrame(Math.min(idx, newFrames.length - 1));
  };

  const addLayer = async () => {
    if (!currentFrame) return;
    const now = new Date().toISOString();
    const newLId = await db.layers.create({ frameId:currentFrame.id, projectId, name:"Layer "+(layers.length+1), order:layers.length, visible:true, locked:false, opacity:100, blendMode:"normal", canvasData:'{"strokes":[]}', createdAt:now });
    // ★ KEY FIX: new layer starts completely empty
    layerStrokes.current = new Map(layerStrokes.current).set(newLId, []);
    setLayers(await db.layers.listByFrame(currentFrame.id));
    setCurrentLayerId(newLId);
  };

  const deleteLayer = async (layerId: number) => {
    if (layers.length <= 1) return;
    await db.layers.delete(layerId);
    const newMap = new Map(layerStrokes.current); newMap.delete(layerId);
    layerStrokes.current = newMap;
    const ls = await db.layers.listByFrame(currentFrame?.id ?? 0);
    setLayers(ls);
    if (currentLayerId === layerId) setCurrentLayerId(ls[0]?.id ?? null);
    redraw();
  };

  const toggleVis = async (layerId: number) => {
    const l = layers.find(x => x.id === layerId); if (!l) return;
    await db.layers.update(layerId, { visible: !l.visible });
    setLayers(prev => prev.map(x => x.id===layerId ? {...x,visible:!x.visible} : x));
  };

  const toggleLock = async (layerId: number) => {
    const l = layers.find(x => x.id === layerId); if (!l) return;
    await db.layers.update(layerId, { locked: !l.locked });
    setLayers(prev => prev.map(x => x.id===layerId ? {...x,locked:!x.locked} : x));
  };

  const changeOpacity = async (layerId: number, val: number) => {
    await db.layers.update(layerId, { opacity: val });
    setLayers(prev => prev.map(x => x.id===layerId ? {...x,opacity:val} : x));
    redraw();
  };

  const moveLayerUp = async (orderIdx: number) => {
    if (orderIdx <= 0) return;
    const sorted = [...layers].sort((a,b)=>b.order-a.order);
    const a = sorted[orderIdx]!, b = sorted[orderIdx-1]!;
    await Promise.all([db.layers.update(a.id,{order:b.order}),db.layers.update(b.id,{order:a.order})]);
    setLayers(prev => prev.map(l => l.id===a.id?{...l,order:b.order}:l.id===b.id?{...l,order:a.order}:l));
    redraw();
  };

  const moveLayerDown = async (orderIdx: number) => {
    const sorted = [...layers].sort((a,b)=>b.order-a.order);
    if (orderIdx >= sorted.length-1) return;
    const a = sorted[orderIdx]!, b = sorted[orderIdx+1]!;
    await Promise.all([db.layers.update(a.id,{order:b.order}),db.layers.update(b.id,{order:a.order})]);
    setLayers(prev => prev.map(l => l.id===a.id?{...l,order:b.order}:l.id===b.id?{...l,order:a.order}:l));
    redraw();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toUpperCase();
      if (k === " ") { e.preventDefault(); setIsPlaying(p=>!p); return; }
      if ((e.ctrlKey||e.metaKey) && k==="Z") { e.preventDefault(); handleUndo(); return; }
      if ((e.ctrlKey||e.metaKey) && k==="Y") { e.preventDefault(); handleRedo(); return; }
      if (k==="ARROWLEFT") void switchFrame(currentFrameIdx-1);
      if (k==="ARROWRIGHT") void switchFrame(currentFrameIdx+1);
      const found = TOOLS.find(t=>t.shortcut===k);
      if (found) setTool(found.id);
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[currentFrameIdx,handleUndo,handleRedo,switchFrame]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#080811]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-violet-900/50">
          <svg width="24" height="24" viewBox="0 0 100 100">
            <rect x="8" y="28" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="8" y="42" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="8" y="56" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="83" y="28" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="83" y="42" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="83" y="56" width="9" height="9" rx="2" fill="rgba(255,255,255,0.5)"/>
            <rect x="22" y="18" width="56" height="64" rx="4" fill="rgba(0,0,0,0.3)"/>
            <rect x="27" y="23" width="20" height="20" rx="3" fill="rgba(255,255,255,0.9)"/>
            <line x1="31" y1="35" x2="42" y2="27" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <polygon points="42,27 44,31 40,32" fill="white"/>
          </svg>
        </div>
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"/>
        <p className="text-sm text-white/40">Loading FlipStudio…</p>
      </div>
    </div>
  );
  if (!project) return null;

  const CW = project.width, CH = project.height;

  return (
    <div className="h-screen w-screen bg-[#080811] flex flex-col overflow-hidden text-white select-none" style={{touchAction:"none"}}>

      {/* TOP BAR */}
      <div className="h-12 border-b border-white/[0.07] bg-[#0e0e1a] flex items-center px-2 gap-1 shrink-0 z-10">
        <button className="w-8 h-8 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          onClick={()=>{ void saveCurrentLayerData().then(()=>setLocation("/")); }}>
          <ArrowLeft className="w-4 h-4"/>
        </button>
        <span className="text-sm font-bold truncate max-w-28 text-white/90 ml-1">{project.name}</span>
        <div className="flex-1"/>

        {/* Playback controls */}
        <div className="flex items-center gap-0.5">
          <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={()=>void switchFrame(0)}><SkipBack className="w-3.5 h-3.5"/></button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={()=>void switchFrame(currentFrameIdx-1)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" strokeLinecap="round"/></svg>
          </button>
          <button className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors mx-1" onClick={()=>setIsPlaying(p=>!p)}>
            {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4 ml-0.5"/>}
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={()=>void switchFrame(currentFrameIdx+1)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" strokeLinecap="round"/></svg>
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={()=>void switchFrame(frames.length-1)}><SkipForward className="w-3.5 h-3.5"/></button>
          <span className="text-[11px] text-white/25 tabular-nums min-w-10 text-center">{currentFrameIdx+1}/{frames.length}</span>
        </div>

        <div className="flex-1"/>

        {/* Right actions */}
        <div className="flex items-center gap-0.5">
          <Tooltip><TooltipTrigger asChild>
            <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={handleUndo}><Undo2 className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5" onClick={handleRedo}><Redo2 className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-8 h-8 rounded flex items-center justify-center hover:bg-white/5 transition-colors",onionSkinning?"text-fuchsia-400":"text-white/25")} onClick={()=>setOnionSkinning(p=>!p)}><Droplets className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Onion Skinning</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-8 h-8 rounded flex items-center justify-center hover:bg-white/5",showGrid?"text-cyan-400":"text-white/25")} onClick={()=>setShowGrid(p=>!p)}><Grid3X3 className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Grid</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-8 h-8 rounded flex items-center justify-center hover:bg-white/5",symmetryMode?"text-yellow-400":"text-white/25")} onClick={()=>setSymmetryMode(p=>!p)}><FlipHorizontal2 className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Symmetry</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className="w-8 h-8 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/5"
              onClick={()=>{ void saveCurrentLayerData().then(()=>setLocation("/projects/"+projectId+"/export")); }}><Download className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Export</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <button className={cn("w-8 h-8 rounded flex items-center justify-center hover:bg-white/5",showLayersPanel?"text-violet-400 bg-violet-600/15":"text-white/35")} onClick={()=>setShowLayersPanel(p=>!p)}><Layers className="w-3.5 h-3.5"/></button>
          </TooltipTrigger><TooltipContent>Layers</TooltipContent></Tooltip>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT TOOLBAR */}
        <div className="w-12 bg-[#0e0e1a] border-r border-white/[0.07] flex flex-col items-center py-2 gap-0.5 overflow-y-auto shrink-0">
          {TOOLS.map(t=>(
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                  tool===t.id?"bg-violet-600 text-white shadow-lg shadow-violet-900/40":"text-white/30 hover:text-white hover:bg-white/5")}
                  onClick={()=>setTool(t.id)}>{t.icon}</button>
              </TooltipTrigger>
              <TooltipContent side="right">{t.label} ({t.shortcut})</TooltipContent>
            </Tooltip>
          ))}

          <div className="w-7 h-px bg-white/[0.07] my-1"/>

          {/* Color swatch */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-9 h-9 rounded-xl border-2 border-white/15 hover:border-violet-500 transition-all shadow-md"
                style={{backgroundColor:color}} onClick={()=>setShowColorPanel(p=>!p)}/>
            </TooltipTrigger>
            <TooltipContent side="right">Color &amp; Brush</TooltipContent>
          </Tooltip>

          <div className="w-7 h-px bg-white/[0.07] my-1"/>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/5 flex items-center justify-center" onClick={flipH}><FlipHorizontal2 className="w-4 h-4"/></button>
          </TooltipTrigger><TooltipContent side="right">Flip Horizontal</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-white/30 hover:text-white hover:bg-white/5 flex items-center justify-center" onClick={flipV}><FlipVIcon/></button>
          </TooltipTrigger><TooltipContent side="right">Flip Vertical</TooltipContent></Tooltip>

          <Tooltip><TooltipTrigger asChild>
            <button className="w-9 h-9 rounded-xl text-red-400/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center" onClick={clearCurrentLayer}><Trash2 className="w-4 h-4"/></button>
          </TooltipTrigger><TooltipContent side="right">Clear Layer</TooltipContent></Tooltip>
        </div>

        {/* COLOR PANEL — floating, left of layers */}
        {showColorPanel && (
          <div className="absolute left-14 top-2 z-30 bg-[#131320] border border-white/10 rounded-2xl p-4 shadow-2xl w-60" style={{maxHeight:"calc(100% - 16px)",overflowY:"auto"}}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Color</span>
              <button className="text-white/25 hover:text-white transition-colors" onClick={()=>setShowColorPanel(false)}><X className="w-4 h-4"/></button>
            </div>
            <ColorWheel value={color} onChange={setColor}/>
            <div className="mt-3 space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-white/35 mb-1"><span>Brush Size</span><span>{size}px</span></div>
                <Slider value={[size]} min={1} max={80} step={1} onValueChange={([v])=>setSize(v!)} className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-white/35 mb-1"><span>Opacity</span><span>{opacity}%</span></div>
                <Slider value={[opacity]} min={1} max={100} step={1} onValueChange={([v])=>setOpacity(v!)} className="[&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0"/>
              </div>
            </div>
          </div>
        )}

        {/* CANVAS AREA */}
        <div className="flex-1 relative overflow-hidden bg-[#111118] flex items-center justify-center" onClick={()=>setShowColorPanel(false)}>
          {/* Transparency grid bg */}
          <div className="absolute inset-0 opacity-30" style={{backgroundImage:"linear-gradient(45deg,#1a1a2e 25%,transparent 25%),linear-gradient(-45deg,#1a1a2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a2e 75%),linear-gradient(-45deg,transparent 75%,#1a1a2e 75%)",backgroundSize:"20px 20px",backgroundPosition:"0 0,0 10px,10px -10px,-10px 0px"}}/>
          <div style={{transform:"scale("+zoom+") translate("+panOffset.x/zoom+"px,"+panOffset.y/zoom+"px)",transformOrigin:"center",transition:"transform 0.1s"}} className="relative shadow-2xl shadow-black/80">
            <canvas ref={canvasRef} width={CW} height={CH}
              className="block"
              style={{width:"min(calc(100vw - 60px), calc((100vh - 160px) * "+CW+" / "+CH+"))",height:"auto",cursor:tool==="move"?"grab":"crosshair",touchAction:"none"}}
              onMouseDown={startDraw} onMouseMove={continueDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={continueDraw} onTouchEnd={endDraw}
            />
            <canvas ref={overlayRef} width={CW} height={CH}
              className="absolute inset-0 pointer-events-none"
              style={{width:"min(calc(100vw - 60px), calc((100vh - 160px) * "+CW+" / "+CH+"))",height:"auto"}}
            />
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-0.5 bg-[#0e0e1a]/90 backdrop-blur-sm rounded-xl px-1 py-1 border border-white/[0.06]">
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10" onClick={()=>setZoom(z=>Math.max(0.1,z-0.25))}><ZoomOut className="w-3.5 h-3.5"/></button>
            <button className="text-[11px] text-white/40 w-10 text-center hover:text-white" onClick={()=>{setZoom(1);setPanOffset({x:0,y:0});}}>{Math.round(zoom*100)}%</button>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10" onClick={()=>setZoom(z=>Math.min(8,z+0.25))}><ZoomIn className="w-3.5 h-3.5"/></button>
          </div>

          {/* Layer indicator */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[#0e0e1a]/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/[0.06]">
            <div className="w-2 h-2 rounded-full bg-violet-500"/>
            <span className="text-[11px] text-white/50 font-medium">{currentLayer?.name ?? "No Layer"}</span>
            {currentLayer?.locked && <Lock className="w-2.5 h-2.5 text-amber-400"/>}
          </div>
        </div>

        {/* ── LAYERS PANEL — right side drawer, does NOT overlay canvas ── */}
        {showLayersPanel && (
          <div className="w-52 bg-[#0e0e1a] border-l border-white/[0.07] flex flex-col shrink-0">
            <div className="h-10 border-b border-white/[0.07] flex items-center px-3 justify-between shrink-0">
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Layers</span>
              <div className="flex gap-1">
                <button className="w-6 h-6 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/10" onClick={addLayer}><Plus className="w-3.5 h-3.5"/></button>
                <button className="w-6 h-6 rounded flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10" onClick={()=>setShowLayersPanel(false)}><X className="w-3.5 h-3.5"/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {sortedLayers.map((layer, ridx) => {
                const idx = sortedLayers.length - 1 - ridx;
                return (
                  <div key={layer.id}
                    className={cn("rounded-xl border p-2 cursor-pointer transition-all",
                      currentLayerId===layer.id?"border-violet-500/35 bg-violet-600/10":"border-transparent hover:border-white/8 hover:bg-white/3")}
                    onClick={()=>setCurrentLayerId(layer.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-7 rounded-md bg-white/5 border border-white/8 shrink-0 flex items-center justify-center">
                        {(layerStrokes.current.get(layer.id)??[]).length>0
                          ? <span className="text-[9px] text-violet-400 font-bold">✓</span>
                          : <span className="text-[9px] text-white/15">—</span>
                        }
                      </div>
                      <span className="flex-1 text-[11px] font-medium text-white/70 truncate">{layer.name}</span>
                      <button className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0",layer.visible?"text-white/40 hover:text-white":"text-white/15")}
                        onClick={e=>{e.stopPropagation();void toggleVis(layer.id);}}>
                        {layer.visible?<Eye className="w-3 h-3"/>:<EyeOff className="w-3 h-3"/>}
                      </button>
                      <button className={cn("w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0",layer.locked?"text-amber-400":"text-white/25")}
                        onClick={e=>{e.stopPropagation();void toggleLock(layer.id);}}>
                        {layer.locked?<Lock className="w-3 h-3"/>:<Unlock className="w-3 h-3"/>}
                      </button>
                      {layers.length>1 && (
                        <button className="w-5 h-5 rounded flex items-center justify-center text-red-400/30 hover:text-red-400 transition-colors shrink-0"
                          onClick={e=>{e.stopPropagation();void deleteLayer(layer.id);}}>
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      )}
                    </div>

                    {currentLayerId===layer.id && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/25 w-6">Op.</span>
                          <Slider value={[layer.opacity]} min={0} max={100} step={1}
                            onValueChange={([v])=>void changeOpacity(layer.id,v!)}
                            className="flex-1 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-0 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                          />
                          <span className="text-[9px] text-white/25 w-6 text-right">{layer.opacity}%</span>
                        </div>
                        <div className="flex gap-1 justify-end">
                          <button className="w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10" onClick={()=>void moveLayerUp(ridx)}><ChevronUp className="w-3.5 h-3.5"/></button>
                          <button className="w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-white hover:bg-white/10" onClick={()=>void moveLayerDown(ridx)}><ChevronDown className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TIMELINE */}
      <div className="bg-[#0e0e1a] border-t border-white/[0.07] shrink-0">
        <div className="h-7 flex items-center px-3 gap-3 border-b border-white/[0.04]">
          <span className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Timeline</span>
          <span className="text-[10px] text-white/15">{project.fps} fps · {frames.length} frame{frames.length!==1?"s":""}</span>
          <div className="flex-1"/>
          <button className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors",loopPlay?"border-violet-500/35 text-violet-400":"border-white/8 text-white/25")} onClick={()=>setLoopPlay(p=>!p)}>
            <Repeat className="w-2.5 h-2.5"/> Loop
          </button>
          <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-violet-500/35 text-violet-400 hover:bg-violet-600/10 transition-colors" onClick={addFrame}>
            <Plus className="w-2.5 h-2.5"/> Add Frame
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-2 overflow-x-auto" style={{height:72}}>
          {frames.map((frame, idx)=>(
            <div key={frame.id}
              className={cn("relative shrink-0 w-14 rounded-xl border-2 cursor-pointer overflow-hidden transition-all group",
                currentFrameIdx===idx?"border-violet-500 ring-1 ring-violet-500/25":"border-white/8 hover:border-white/20")}
              style={{height:52}}
              onClick={()=>!isPlaying&&void switchFrame(idx)}
            >
              {frame.thumbnail
                ? <img src={frame.thumbnail} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full bg-white/3 flex items-center justify-center"><span className="text-[10px] text-white/15">{idx+1}</span></div>
              }
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                <button className="w-6 h-6 rounded flex items-center justify-center text-white hover:bg-white/20" onClick={e=>{e.stopPropagation();void duplicateFrame(idx);}}><Copy className="w-3 h-3"/></button>
                {frames.length>1 && <button className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-500/20" onClick={e=>{e.stopPropagation();void deleteFrame(idx);}}><Trash2 className="w-3 h-3"/></button>}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-3 flex items-end px-1">
                <span className="text-[8px] text-white/35">{idx+1}</span>
              </div>
              {currentFrameIdx===idx && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"/>}
            </div>
          ))}
        </div>
      </div>

      <Watermark/>
    </div>
  );
}
