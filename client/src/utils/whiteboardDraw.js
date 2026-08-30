export const CANVAS_W = 1200;
export const CANVAS_H = 800;

export const SHAPE_TOOLS = ["rect", "ellipse", "triangle", "line"];
export const BOX_TOOLS = ["rect", "ellipse", "triangle", "text"];

const toPx = (p) => ({
  x: p.x * CANVAS_W,
  y: p.y * CANVAS_H,
});

export const boundsFromPoints = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
};

const strokeStyle = (ctx, tool, color, width) => {
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.lineWidth = tool === "eraser" ? width * 3 : width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};

const drawFreehand = (ctx, points, tool, color, width) => {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * CANVAS_W, points[0].y * CANVAS_H);

  for (let i = 1; i < points.length - 1; i++) {
    const mid = {
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    };
    ctx.quadraticCurveTo(
      points[i].x * CANVAS_W,
      points[i].y * CANVAS_H,
      mid.x * CANVAS_W,
      mid.y * CANVAS_H,
    );
  }

  const last = points[points.length - 1];
  ctx.lineTo(last.x * CANVAS_W, last.y * CANVAS_H);
  strokeStyle(ctx, tool, color, width);
  ctx.stroke();
};

const drawRect = (ctx, a, b, tool, color, width, dashed = false) => {
  const { x, y, w, h } = boundsFromPoints(toPx(a), toPx(b));
  ctx.beginPath();
  if (dashed) ctx.setLineDash([8, 6]);
  ctx.rect(x, y, w, h);
  strokeStyle(ctx, tool, color, width);
  ctx.stroke();
  ctx.setLineDash([]);
};

const drawEllipse = (ctx, a, b, tool, color, width) => {
  const { x, y, w, h } = boundsFromPoints(toPx(a), toPx(b));
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 0.5), Math.max(h / 2, 0.5), 0, 0, Math.PI * 2);
  strokeStyle(ctx, tool, color, width);
  ctx.stroke();
};

const drawTriangle = (ctx, a, b, tool, color, width) => {
  const { x, y, w, h } = boundsFromPoints(toPx(a), toPx(b));
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  strokeStyle(ctx, tool, color, width);
  ctx.stroke();
};

const drawLine = (ctx, a, b, tool, color, width) => {
  const p0 = toPx(a);
  const p1 = toPx(b);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  strokeStyle(ctx, tool, color, width);
  ctx.stroke();
};

const wrapLines = (ctx, text, maxWidth) => {
  const paragraphs = String(text).split("\n");
  const lines = [];
  paragraphs.forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  });
  return lines;
};

const fontSizeForBox = (boxH, width) => {
  const fromBox = boxH * 0.45;
  const fromStroke = 10 + width * 2;
  return Math.max(12, Math.min(fromBox || fromStroke, 64));
};

const drawText = (ctx, a, b, color, width, text, preview = false) => {
  const { x, y, w, h } = boundsFromPoints(toPx(a), toPx(b));
  if (preview || !text) {
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.rect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const fontSize = fontSizeForBox(h, width);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  const pad = 4;
  const lines = wrapLines(ctx, text, Math.max(w - pad * 2, 8));
  const lineHeight = fontSize * 1.2;
  lines.forEach((line, i) => {
    if ((i + 1) * lineHeight > h) return;
    ctx.fillText(line, x + pad, y + pad + i * lineHeight);
  });
};

export const drawStroke = (ctx, stroke, options = {}) => {
  const { points, tool, color, width, text } = stroke;
  if (!points || points.length < 2) return;

  ctx.save();
  const a = points[0];
  const b = points[points.length - 1];

  if (tool === "rect") drawRect(ctx, a, b, tool, color, width, options.preview);
  else if (tool === "ellipse") drawEllipse(ctx, a, b, tool, color, width);
  else if (tool === "triangle") drawTriangle(ctx, a, b, tool, color, width);
  else if (tool === "line") drawLine(ctx, a, b, tool, color, width);
  else if (tool === "text") drawText(ctx, a, b, color, width, text, options.preview);
  else drawFreehand(ctx, points, tool, color, width);
  ctx.restore();
};

export const ensureMinSize = (start, end, tool) => {
  if (tool === "line") return [start, end];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const min = 0.04;
  const next = { ...end };
  if (Math.abs(dx) < min) next.x = start.x + (dx < 0 ? -min : min);
  if (Math.abs(dy) < min) next.y = start.y + (dy < 0 ? -min : min);
  next.x = Math.min(1, Math.max(0, next.x));
  next.y = Math.min(1, Math.max(0, next.y));
  return [start, next];
};
