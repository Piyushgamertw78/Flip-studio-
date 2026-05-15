import { useState, useRef, useEffect, useCallback } from "react";
  import { useLocation } from "wouter";
  import {
    ArrowLeft, Pencil, Eraser, Square, Circle, Minus, Type,
    Trash2, Download, ZoomIn, ZoomOut, Grid3X3, Undo2, Redo2,
    PaintBucket, Move, Maximize2, Triangle, ArrowRight as ArrowTool, X,
    Palette, Users, Copy, Check, Link, Wifi, WifiOff,
  } from "lucide-react";
  import { Watermark } from "@/components/watermark";
  import { cn } from "@/lib/utils";

  type Tool = "pencil" | "eraser" | "line" | "rect" | "ellipse" | "triangle" | "arrow" | "text" | "fill" | "move";

  interface Stroke {
    tool: Tool;
    color: string;
    size: number;
    points: { x: number; y: number }[];
    text?: string;
    x?: number;
    y?: number;
  }

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pencil", icon: <Pencil className="w-4 h-4" />, label: "Pencil" },
    { id: "eraser", icon: <Eraser className="w-4 h-4" />, label: "Eraser" },
    { id: "move", icon: <Move className="w-4 h-4" />, label: "Pan" },
    { id: "line", icon: <Minus className="w-4 h-4" />, label: "Line" },
    { id: "rect", icon: <Square className="w-4 h-4" />, label: "Rectangle" },
    { id: "ellipse", icon: <Circle className="w-4 h-4" />, label: "Ellipse" },
    { id: "triangle", icon: <Triangle className="w-4 h-4" />, label: "Triangle" },
    { id: "arrow", icon: <ArrowTool className="w-4 h-4" />, label: "Arrow" },
    { id: "fill", icon: <PaintBucket className="w-4 h-4" />, label: "Fill" },
    { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
  ];

  const COLORS = [
    "#ffffff","#000000","#ef4444","#f97316","#eab308",
    "#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4",
    "#84cc16","#f59e0b","#6366f1","#14b8a6","#64748b","#a3a3a3",
  ];

  const SIZES = [2, 4, 8, 16];

  function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 18;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath(); ctx.fill();
  }

  function drawTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo((x1 + x2) / 2, y1); ctx.lineTo(x2, y2); ctx.lineTo(x1, y2);
    ctx.closePath(); ctx.stroke();
  }

  export default function Whiteboard() {
    const [, setLocation] = useLocation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [tool, setTool] = useState<Tool>("pencil");
    const [color, setColor] = useState("#ffffff");
    const [size, setSize] = useState(4);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [showGrid, setShowGrid] = useState(true);
    const [bgColor, setBgColor] = useState("#111115");
    const [showColorPanel, setShowColorPanel] = useState(false);

    // ── Multiplayer collab state ──
    const [roomId, setRoomId] = useState("");
    const [inputRoom, setInputRoom] = useState("");
    const [showCollabPanel, setShowCollabPanel] = useState(false);
    const [collabPeers, setCollabPeers] = useState(0);
    const [collabConnected, setCollabConnected] = useState(false);
    const sseRef = useRef<EventSource | null>(null);
    const isCollab = useRef(false);

    const getApiBase = () => {
      if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
        return "https://" + (import.meta.env.VITE_API_HOST ?? "localhost");
      }
      return "";
    };

    const joinRoom = (id: string) => {
      if (sseRef.current) { sseRef.current.close(); }
      const base = getApiBase();
      const sse = new EventSource(base + "/api/collab/rooms/" + id + "/join");
      sse.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; peers?: number; stroke?: unknown };
          if (msg.type === "welcome" || msg.type === "peer_joined" || msg.type === "peer_left") {
            setCollabPeers(msg.peers ?? 0);
          }
          if (msg.type === "stroke") {
            const s = (msg as any) as Stroke;
            strokesRef.current.push(s);
            redrawAll();
          }
        } catch { /* ignore */ }
      };
      sse.onopen = () => { setCollabConnected(true); isCollab.current = true; };
      sse.onerror = () => setCollabConnected(false);
      sseRef.current = sse;
      setRoomId(id);
      setShowCollabPanel(false);
    };

    const leaveRoom = () => {
      sseRef.current?.close();
      sseRef.current = null;
      isCollab.current = false;
      setCollabConnected(false);
      setRoomId("");
      setCollabPeers(0);
    };

    const broadcastStroke = (stroke: Stroke) => {
      if (!isCollab.current || !roomId) return;
      const base = getApiBase();
      void fetch(base + "/api/collab/rooms/" + roomId + "/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stroke),
      }).catch(() => {});
    };

    useEffect(() => { return () => sseRef.current?.close(); }, []);

    const strokesRef = useRef<Stroke[]>([]);
    const undoStackRef = useRef<Stroke[][]>([]);
    const redoStackRef = useRef<Stroke[][]>([]);
    const isDrawingRef = useRef(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const startPtRef = useRef<{ x: number; y: number } | null>(null);
    const isPanningRef = useRef(false);
    const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

    const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

    const CANVAS_W = 3840;
    const CANVAS_H = 2160;

    // Android back button
    useEffect(() => {
      const onBack = (e: Event) => { e.preventDefault(); setLocation("/"); };
      document.addEventListener("backbutton", onBack, true);
      return () => document.removeEventListener("backbutton", onBack, true);
    }, [setLocation]);

    const redrawAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        const step = 60;
        for (let x = 0; x <= CANVAS_W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
        for (let y = 0; y <= CANVAS_H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
      }
      for (const stroke of strokesRef.current) renderStroke(ctx, stroke);
    }, [bgColor, showGrid]);

    const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      if (stroke.tool === "text" && stroke.text && stroke.x !== undefined && stroke.y !== undefined) {
        ctx.font = `${Math.max(stroke.size * 4, 16)}px Inter, sans-serif`;
        ctx.fillText(stroke.text, stroke.x, stroke.y);
      } else if (stroke.tool === "pencil" || stroke.tool === "eraser") {
        if (stroke.points.length < 2) return;
        ctx.beginPath(); ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const xc = (stroke.points[i]!.x + stroke.points[i + 1]!.x) / 2;
          const yc = (stroke.points[i]!.y + stroke.points[i + 1]!.y) / 2;
          ctx.quadraticCurveTo(stroke.points[i]!.x, stroke.points[i]!.y, xc, yc);
        }
        ctx.stroke();
      } else if (stroke.points.length >= 2) {
        const p0 = stroke.points[0]!;
        const p1 = stroke.points[stroke.points.length - 1]!;
        if (stroke.tool === "line") { ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
        else if (stroke.tool === "rect") { ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y); }
        else if (stroke.tool === "ellipse") {
          ctx.beginPath();
          ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        else if (stroke.tool === "triangle") { drawTriangle(ctx, p0.x, p0.y, p1.x, p1.y); }
        else if (stroke.tool === "arrow") { drawArrow(ctx, p0.x, p0.y, p1.x, p1.y); }
      }
      ctx.globalCompositeOperation = "source-over";
    };

    useEffect(() => { redrawAll(); }, [redrawAll]);

    const getCanvasPt = (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      setShowColorPanel(false);
      if (tool === "move" || e.button === 1) {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
        return;
      }
      if (tool === "text") { const pt = getCanvasPt(e); setTextInput({ x: pt.x, y: pt.y, value: "" }); return; }
      isDrawingRef.current = true;
      const pt = getCanvasPt(e);
      startPtRef.current = pt;
      if (tool === "pencil" || tool === "eraser") {
        currentStrokeRef.current = { tool, color, size, points: [pt] };
      } else {
        currentStrokeRef.current = { tool, color, size, points: [pt, { ...pt }] };
      }
      undoStackRef.current.push([...strokesRef.current]);
      redoStackRef.current = [];
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (isPanningRef.current && panStartRef.current) {
        setPanX(panStartRef.current.px + (e.clientX - panStartRef.current.x));
        setPanY(panStartRef.current.py + (e.clientY - panStartRef.current.y));
        return;
      }
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      const pt = getCanvasPt(e);
      if (tool === "pencil" || tool === "eraser") {
        currentStrokeRef.current.points.push(pt);
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (tool === "eraser") ctx.globalCompositeOperation = "destination-out";
        const pts = currentStrokeRef.current.points; const len = pts.length;
        if (len >= 3) {
          ctx.beginPath();
          const xc = (pts[len - 2]!.x + pts[len - 1]!.x) / 2;
          const yc = (pts[len - 2]!.y + pts[len - 1]!.y) / 2;
          ctx.moveTo((pts[len - 3]!.x + pts[len - 2]!.x) / 2, (pts[len - 3]!.y + pts[len - 2]!.y) / 2);
          ctx.quadraticCurveTo(pts[len - 2]!.x, pts[len - 2]!.y, xc, yc);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      } else {
        currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1] = pt;
        const overlay = overlayRef.current; if (!overlay) return;
        const ctx = overlay.getContext("2d"); if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        renderStroke(ctx, currentStrokeRef.current);
      }
    };

    const handlePointerUp = () => {
      isPanningRef.current = false; panStartRef.current = null;
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      isDrawingRef.current = false;
      const overlay = overlayRef.current;
      if (overlay) { const ctx = overlay.getContext("2d"); if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); }
      const finishedStroke = currentStrokeRef.current;
      strokesRef.current.push(finishedStroke);
      broadcastStroke(finishedStroke);
      currentStrokeRef.current = null;
      redrawAll();
    };

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };

    const undo = () => {
      if (undoStackRef.current.length === 0) return;
      redoStackRef.current.push([...strokesRef.current]);
      strokesRef.current = undoStackRef.current.pop()!;
      redrawAll();
    };

    const redo = () => {
      if (redoStackRef.current.length === 0) return;
      undoStackRef.current.push([...strokesRef.current]);
      strokesRef.current = redoStackRef.current.pop()!;
      redrawAll();
    };

    const clearAll = () => {
      undoStackRef.current.push([...strokesRef.current]);
      strokesRef.current = [];
      redrawAll();
    };

    const exportPng = () => {
      const canvas = canvasRef.current; if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "whiteboard.png"; a.click();
    };

    const commitText = (value: string) => {
      if (!textInput || !value.trim()) { setTextInput(null); return; }
      strokesRef.current.push({ tool: "text", color, size, points: [{ x: textInput.x, y: textInput.y }], text: value, x: textInput.x, y: textInput.y });
      setTextInput(null); redrawAll();
    };

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || textInput) return;
        const map: Record<string, Tool> = { p: "pencil", e: "eraser", v: "move", l: "line", r: "rect", o: "ellipse", t: "triangle", a: "arrow", f: "fill", x: "text" };
        if (map[e.key]) setTool(map[e.key]!);
        if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [textInput]);

    return (
      <div className="h-screen w-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden select-none">
        {/* Top Bar — compact, no overflow issues */}
        <div className="h-11 flex items-center px-2 gap-1 border-b border-white/10 bg-black/40 backdrop-blur shrink-0">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-white/80 mr-1">Whiteboard</span>
          <div className="flex-1" />
          <button onClick={undo} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Undo"><Undo2 className="w-4 h-4" /></button>
          <button onClick={redo} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Redo"><Redo2 className="w-4 h-4" /></button>
          <button onClick={() => setShowGrid(!showGrid)} className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", showGrid ? "bg-violet-600/40 text-violet-300" : "text-white/50 hover:text-white hover:bg-white/10")} title="Toggle Grid"><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-[10px] text-white/30 tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(8, z * 1.25))} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={clearAll} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
          {/* Collab button */}
          <button onClick={() => setShowCollabPanel(p => !p)}
            className={cn("flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-bold transition-colors shrink-0",
              collabConnected
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-white/10 hover:bg-white/20 text-white/60")}>
            {collabConnected ? <Wifi className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            {collabConnected ? <span className="ml-1">{collabPeers + 1}</span> : null}
          </button>
          <button onClick={exportPng} className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" /><span>PNG</span>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT TOOLBAR — single narrow column, no color column */}
          <div className="w-12 flex flex-col items-center py-2 gap-0.5 border-r border-white/10 bg-black/20 shrink-0 overflow-y-auto">
            {TOOLS.map((t) => (
              <button key={t.id} title={t.label}
                className={cn("w-9 h-9 flex items-center justify-center rounded-lg transition-all",
                  tool === t.id ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "text-white/40 hover:text-white hover:bg-white/10")}
                onClick={() => setTool(t.id)}>
                {t.icon}
              </button>
            ))}

            <div className="w-8 border-t border-white/10 my-1.5" />

            {/* Color swatch — opens floating color panel */}
            <button title="Colors"
              className={cn("w-9 h-9 rounded-lg border-[3px] transition-all shadow-md",
                showColorPanel ? "border-violet-500 scale-110" : "border-white/20")}
              style={{ backgroundColor: color }}
              onClick={() => setShowColorPanel(p => !p)} />

            <div className="w-8 border-t border-white/10 my-1.5" />

            {/* Brush size dots */}
            {SIZES.map((s) => (
              <button key={s}
                className={cn("flex items-center justify-center w-9 h-8 rounded-lg transition-all", size === s ? "bg-violet-600/40" : "hover:bg-white/10")}
                onClick={() => setSize(s)}>
                <div className="rounded-full bg-white" style={{ width: Math.min(s * 1.8, 18), height: Math.min(s * 1.8, 18) }} />
              </button>
            ))}
          </div>

          {/* Collab panel */}
          {showCollabPanel && (
            <div className="absolute left-0 right-0 top-0 z-50 bg-[#0f0f1e] border-b border-white/15 p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                    <Users className="w-4 h-4 text-violet-400"/>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Collab Drawing</p>
                    <p className="text-[11px] text-white/40">Draw together in real-time</p>
                  </div>
                </div>
                <button onClick={() => setShowCollabPanel(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              {collabConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Wifi className="w-4 h-4 text-emerald-400 shrink-0"/>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-300">Connected — Room: <span className="font-mono">{roomId}</span></p>
                      <p className="text-[11px] text-white/40">{collabPeers} other{collabPeers !== 1 ? "s" : ""} drawing</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void navigator.clipboard.writeText(roomId)}
                      className="flex-1 h-9 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-white/70 flex items-center justify-center gap-1.5 transition-colors">
                      <Copy className="w-3.5 h-3.5"/> Copy Room Code
                    </button>
                    <button onClick={leaveRoom}
                      className="flex-1 h-9 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-xs font-semibold text-red-400 flex items-center justify-center gap-1.5 transition-colors border border-red-500/20">
                      <WifiOff className="w-3.5 h-3.5"/> Leave
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-white/40 mb-2 font-semibold">CREATE a new room or JOIN with a code</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50 font-mono placeholder:text-white/20"
                        placeholder="Room code (e.g. piyush42)"
                        value={inputRoom}
                        onChange={e => setInputRoom(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                        onKeyDown={e => e.key === "Enter" && inputRoom && joinRoom(inputRoom)}
                      />
                      <button
                        disabled={!inputRoom}
                        onClick={() => joinRoom(inputRoom)}
                        className="px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                        Join
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-white/10"/>
                    <span className="text-[10px] text-white/25 font-semibold">OR</span>
                    <div className="flex-1 h-px bg-white/10"/>
                  </div>
                  <button
                    onClick={() => {
                      const code = Math.random().toString(36).slice(2, 8);
                      setInputRoom(code);
                      joinRoom(code);
                    }}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                    <Link className="w-4 h-4"/> Create New Room
                  </button>
                  <p className="text-[10px] text-white/25 text-center">Share the room code with friends so they can join</p>
                </div>
              )}
            </div>
          )}

          {/* Floating color picker panel */}
          {showColorPanel && (
            <div className="absolute left-12 top-2 z-50 bg-[#13131f] border border-white/15 rounded-2xl shadow-2xl p-3 w-52">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/60">Colors</span>
                <button onClick={() => setShowColorPanel(false)} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Preset colors grid */}
              <div className="grid grid-cols-6 gap-1.5 mb-3">
                {COLORS.map((c) => (
                  <button key={c}
                    className="w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 active:scale-95"
                    style={{ backgroundColor: c, borderColor: color === c ? "#8b5cf6" : "transparent" }}
                    onClick={() => { setColor(c); setShowColorPanel(false); }} />
                ))}
              </div>
              {/* Custom color + BG color */}
              <div className="flex gap-2 items-center">
                <label className="flex-1 h-8 rounded-lg border border-white/15 cursor-pointer overflow-hidden relative flex items-center justify-center gap-1.5 text-[10px] text-white/50 font-semibold hover:border-violet-400 transition-colors">
                  <Palette className="w-3 h-3" /> Custom
                  <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={color} onChange={(e) => setColor(e.target.value)} />
                </label>
                <label className="flex-1 h-8 rounded-lg border border-white/15 cursor-pointer overflow-hidden relative flex items-center justify-center text-[10px] text-white/50 font-semibold hover:border-violet-400 transition-colors" title="Canvas background color">
                  <span>BG</span>
                  <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                </label>
              </div>
            </div>
          )}

          {/* Canvas area — takes all remaining width */}
          <div className="flex-1 relative overflow-hidden" style={{ background: "#0a0a10" }} onWheel={handleWheel} ref={containerRef}
            onClick={() => showColorPanel && setShowColorPanel(false)}>
            <div className="absolute"
              style={{ top: "50%", left: "50%", transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`, transformOrigin: "center" }}>
              <div className="relative shadow-2xl shadow-black/80" style={{ width: CANVAS_W, height: CANVAS_H }}>
                <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="absolute inset-0 block" />
                <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H}
                  className={cn("absolute inset-0 block touch-none", tool === "move" ? "cursor-grab" : tool === "text" ? "cursor-text" : "cursor-crosshair")}
                  onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
                {textInput && (
                  <input autoFocus type="text"
                    className="absolute bg-transparent border-none outline-none text-white"
                    style={{ left: textInput.x * zoom, top: textInput.y * zoom, fontSize: `${Math.max(size * 4, 16) * zoom}px`, color, fontFamily: "Inter, sans-serif", minWidth: 80 }}
                    value={textInput.value}
                    onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") commitText(textInput.value); if (e.key === "Escape") setTextInput(null); }}
                    onBlur={() => commitText(textInput.value)} />
                )}
              </div>
            </div>
          </div>
        </div>
        <Watermark />
      </div>
    );
  }
  