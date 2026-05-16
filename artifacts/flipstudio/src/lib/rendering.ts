// Shared rendering utilities for FlipStudio

export interface Point { x: number; y: number; pressure: number }
export type Tool =
  | "pencil" | "pen" | "brush" | "eraser" | "fill" | "move"
  | "line" | "rect" | "ellipse" | "triangle" | "arrow" | "text" | "eyedropper"
  | "chalk" | "marker" | "watercolor" | "spray" | "calligraphy"
  | "star" | "polygon" | "lasso" | "select" | "crop" | "gradient";

export interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  hardness?: number;
  flow?: number;
  points: Point[];
  text?: string;
  textX?: number;
  textY?: number;
  textSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  filled?: boolean;
  sides?: number; // polygon/star
  imageData?: string; // baked PNG data-URL (used by layer adjust / filter apply)
  blendMode?: string;
}

export interface CanvasData { strokes: Stroke[] }

export function safeParseCanvas(raw: string): CanvasData {
  try {
    const d = JSON.parse(raw) as CanvasData;
    return { strokes: Array.isArray(d.strokes) ? d.strokes : [] };
  } catch { return { strokes: [] }; }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r || 0, g || 0, b || 0];
}

function _hexToRgba(hex: string): [number,number,number,number] {
  const h = hex.replace("#","");
  if (h.length === 3) {
    return [parseInt(h[0]!+h[0]!,16),parseInt(h[1]!+h[1]!,16),parseInt(h[2]!+h[2]!,16),255];
  }
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),255];
}

function _floodFillCtx(
  ctx: CanvasRenderingContext2D,
  startX: number, startY: number,
  fillColor: string, opacity: number,
  w: number, h: number
) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const startIdx = (startY * w + startX) * 4;
  const tr = data[startIdx]!;
  const tg = data[startIdx+1]!;
  const tb = data[startIdx+2]!;
  const ta = data[startIdx+3]!;
  const [fr,fg,fb] = _hexToRgba(fillColor);
  const fa = Math.round(opacity * 255);
  if (tr===fr && tg===fg && tb===fb && ta===fa) return;
  const tolerance = 32;
  const matches = (i4: number) =>
    Math.abs(data[i4]!-tr)<=tolerance &&
    Math.abs(data[i4+1]!-tg)<=tolerance &&
    Math.abs(data[i4+2]!-tb)<=tolerance &&
    Math.abs(data[i4+3]!-ta)<=tolerance;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [startY * w + startX];
  while (stack.length) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    const i4 = idx * 4;
    if (!matches(i4)) continue;
    visited[idx] = 1;
    data[i4]=fr; data[i4+1]=fg; data[i4+2]=fb; data[i4+3]=fa;
    const x = idx % w, y = (idx/w)|0;
    if (x > 0)     stack.push(idx-1);
    if (x < w-1)   stack.push(idx+1);
    if (y > 0)     stack.push(idx-w);
    if (y < h-1)   stack.push(idx+w);
  }
  ctx.putImageData(imageData, 0, 0);
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number
) {
  for (const s of strokes) {
    renderSingleStroke(ctx, s, w, h);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function renderSingleStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  w: number,
  h: number
) {
  const opacity = (s.opacity ?? 100) / 100;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.lineWidth = s.size;
    if (s.points.length < 2) {
      const p = s.points[0];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
    for (let i = 1; i < s.points.length - 1; i++) {
      const xc = (s.points[i]!.x + s.points[i + 1]!.x) / 2 * w;
      const yc = (s.points[i]!.y + s.points[i + 1]!.y) / 2 * h;
      ctx.quadraticCurveTo(s.points[i]!.x * w, s.points[i]!.y * h, xc, yc);
    }
    const last = s.points[s.points.length - 1]!;
    ctx.lineTo(last.x * w, last.y * h);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  ctx.globalCompositeOperation = "source-over";

  if (s.tool === "fill") {
    const p = s.points[0];
    if (p && w > 0 && h > 0) {
      const sx = Math.max(0, Math.min(w - 1, Math.floor(p.x * w)));
      const sy = Math.max(0, Math.min(h - 1, Math.floor(p.y * h)));
      _floodFillCtx(ctx, sx, sy, s.color, opacity, w, h);
    } else {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = s.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    return;
  }

  // Gradient fill stroke
  if (s.tool === "gradient" && s.points.length >= 2) {
    const p0 = s.points[0]!, p1 = s.points[s.points.length - 1]!;
    let grad: CanvasGradient;
    if ((s as unknown as { gradientType?: string }).gradientType === "radial") {
      const dx = (p1.x - p0.x) * w, dy = (p1.y - p0.y) * h;
      const r = Math.sqrt(dx*dx + dy*dy);
      grad = ctx.createRadialGradient(p0.x*w, p0.y*h, 0, p0.x*w, p0.y*h, Math.max(1, r));
    } else {
      grad = ctx.createLinearGradient(p0.x*w, p0.y*h, p1.x*w, p1.y*h);
    }
    grad.addColorStop(0, s.color);
    const color2 = (s as unknown as { color2?: string }).color2 ?? "#000000";
    grad.addColorStop(1, color2);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    return;
  }

  // Baked image stroke (used by layer adjust, stamp, etc.)
  if (s.imageData) {
    const img = new Image();
    img.src = s.imageData;
    ctx.globalAlpha = opacity;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalAlpha = 1;
    return;
  }

  if (s.tool === "text" && s.text && s.textX !== undefined && s.textY !== undefined) {
    ctx.globalAlpha = opacity;
    const fs = (s.textSize ?? s.size * 5);
    const ff = s.fontFamily ?? "Inter, sans-serif";
    const fst = s.fontStyle ?? "normal";
    ctx.font = `${fst} ${fs}px ${ff}`;
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.textX * w, s.textY * h);
    ctx.globalAlpha = 1;
    return;
  }

  if (!s.points.length) return;

  // Shape tools
  if (s.points.length >= 2) {
    const p0 = s.points[0]!;
    const p1 = s.points[s.points.length - 1]!;
    const x0 = p0.x * w, y0 = p0.y * h, x1 = p1.x * w, y1 = p1.y * h;

    if (s.tool === "line") {
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "rect") {
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      if (s.filled) { ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      else { ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); }
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "ellipse") {
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (s.filled) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "triangle") {
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo((x0 + x1) / 2, y0);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      if (s.filled) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "arrow") {
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const hw = Math.max(10, s.size * 4);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - hw * Math.cos(angle - Math.PI / 6), y1 - hw * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 - hw * Math.cos(angle + Math.PI / 6), y1 - hw * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "star") {
      const sides = s.sides ?? 5;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const outerR = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
      const innerR = outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < sides * 2; i++) {
        const angle = (i * Math.PI) / sides - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (s.filled) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (s.tool === "polygon") {
      const sides = s.sides ?? 6;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = s.size;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const r = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (s.filled) ctx.fill(); else ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
  }

  // Freehand tools
  if (s.tool === "chalk") {
    ctx.globalAlpha = opacity * 0.7;
    ctx.lineWidth = s.size;
    for (let i = 0; i < s.points.length - 1; i++) {
      const p = s.points[i]!, q = s.points[i + 1]!;
      // Chalk texture: multiple offset strokes
      for (let j = 0; j < 3; j++) {
        const ox = (Math.random() - 0.5) * s.size * 0.4;
        const oy = (Math.random() - 0.5) * s.size * 0.4;
        ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.5);
        ctx.lineWidth = s.size * (0.3 + Math.random() * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.x * w + ox, p.y * h + oy);
        ctx.lineTo(q.x * w + ox, q.y * h + oy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (s.tool === "marker") {
    ctx.globalAlpha = opacity * 0.6;
    ctx.lineWidth = s.size * 2;
    ctx.lineCap = "square";
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i]!.x * w, s.points[i]!.y * h);
    }
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.globalAlpha = 1;
    return;
  }

  if (s.tool === "watercolor") {
    const [r, g, b] = hexToRgb(s.color);
    for (let i = 0; i < s.points.length - 1; i++) {
      const p = s.points[i]!, q = s.points[i + 1]!;
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        const x = (p.x + (q.x - p.x) * t) * w;
        const y = (p.y + (q.y - p.y) * t) * h;
        const radius = s.size * (0.5 + Math.random() * 1.5);
        const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
        blob.addColorStop(0, `rgba(${r},${g},${b},${opacity * 0.15})`);
        blob.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = blob;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = s.color;
    return;
  }

  if (s.tool === "spray") {
    const [r, g, b] = hexToRgb(s.color);
    ctx.globalAlpha = opacity;
    for (const p of s.points) {
      const count = Math.floor(s.size * 0.8);
      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * s.size;
        const x = p.x * w + radius * Math.cos(angle);
        const y = p.y * h + radius * Math.sin(angle);
        const dot = 1 + Math.random() * 1.5;
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.random() * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 1;
    return;
  }

  if (s.tool === "calligraphy") {
    ctx.globalAlpha = opacity;
    const baseWidth = s.size;
    for (let i = 0; i < s.points.length - 1; i++) {
      const p = s.points[i]!, q = s.points[i + 1]!;
      const dx = (q.x - p.x) * w, dy = (q.y - p.y) * h;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w1 = baseWidth * (0.5 + p.pressure * 0.5);
      const w2 = baseWidth * (0.5 + q.pressure * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x * w + nx * w1, p.y * h + ny * w1);
      ctx.lineTo(q.x * w + nx * w2, q.y * h + ny * w2);
      ctx.lineTo(q.x * w - nx * w2, q.y * h - ny * w2);
      ctx.lineTo(p.x * w - nx * w1, p.y * h - ny * w1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Default pencil/pen/brush
  if (s.points.length < 2) return;
  ctx.lineWidth = s.tool === "brush" ? s.size * 2.5 : s.size;
  if (s.tool === "brush") ctx.globalAlpha = opacity * 0.65;
  else ctx.globalAlpha = opacity;

  ctx.beginPath();
  ctx.moveTo(s.points[0]!.x * w, s.points[0]!.y * h);
  for (let i = 1; i < s.points.length - 1; i++) {
    const xc = (s.points[i]!.x + s.points[i + 1]!.x) / 2 * w;
    const yc = (s.points[i]!.y + s.points[i + 1]!.y) / 2 * h;
    ctx.quadraticCurveTo(s.points[i]!.x * w, s.points[i]!.y * h, xc, yc);
  }
  const last = s.points[s.points.length - 1]!;
  ctx.lineTo(last.x * w, last.y * h);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function compositeAllLayers(
  targetCtx: CanvasRenderingContext2D,
  layers: Array<{ id: number; visible: boolean; order: number; opacity: number; blendMode: string }>,
  layerStrokes: Map<number, Stroke[]>,
  w: number,
  h: number,
  bgColor: string
) {
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
    targetCtx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || "source-over";
    targetCtx.drawImage(tmp, 0, 0);
    targetCtx.globalAlpha = 1;
    targetCtx.globalCompositeOperation = "source-over";
  }
}
