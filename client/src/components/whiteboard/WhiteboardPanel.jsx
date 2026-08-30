import { useEffect, useRef, useCallback, useState } from "react";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const THROTTLE_MS = 30;

const COLORS = [
  "#1a1a1a",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ec4899",
];
const WIDTHS = [
  { label: "S", value: 2 },
  { label: "M", value: 5 },
  { label: "L", value: 12 },
  { label: "XL", value: 24 },
];

const drawPath = (ctx, points, tool, color, width) => {
  if (!points || points.length < 2) return;
  ctx.save();
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

  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.lineWidth = tool === "eraser" ? width * 3 : width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
};

const WhiteboardPanel = ({
  isHost = false,
  strokes,
  activeStrokes,
  emitStroke,
  emitDrawing,
  emitUndo,
  emitClear,
  aiGenerating = false,
  emitAIPrompt,
}) => {
  const mainRef = useRef(null);
  const previewRef = useRef(null);

  const isDrawing = useRef(false);
  const currentPoints = useRef([]);
  const lastEmit = useRef(0);
  const activeStrokesRef = useRef({});
  const toolRef = useRef("pen");
  const colorRef = useRef("#1a1a1a");
  const widthRef = useRef(5);

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#1a1a1a");
  const [lineWidth, setLineWidth] = useState(5);
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    widthRef.current = lineWidth;
  }, [lineWidth]);

  useEffect(() => {
    const canvas = mainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    strokes.forEach(({ points: pts, tool: t, color: c, width: w }) =>
      drawPath(ctx, pts, t, c, w),
    );
  }, [strokes]);

  const redrawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    Object.values(activeStrokesRef.current).forEach(({ points: pts, tool: t, color: c, width: w }) =>
      drawPath(ctx, pts, t, c, w),
    );

    if (isDrawing.current && currentPoints.current.length >= 2) {
      drawPath(ctx, currentPoints.current, toolRef.current, colorRef.current, widthRef.current);
    }
  }, []);

  useEffect(() => {
    activeStrokesRef.current = activeStrokes;
    redrawPreview();
  }, [activeStrokes, redrawPreview]);

  useEffect(() => {
    if (!isHost) return; //  participants don't get Ctrl+Z
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        emitUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isHost, emitUndo]);

  const getPos = useCallback((e) => {
    const rect = previewRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) / rect.width,
      y: (src.clientY - rect.top) / rect.height,
    };
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (!isHost) return;
      e.preventDefault();
      isDrawing.current = true;
      currentPoints.current = [getPos(e)];
    },
    [isHost, getPos],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isHost) return;
      e.preventDefault();
      if (!isDrawing.current) return;

      currentPoints.current.push(getPos(e));
      redrawPreview();

      const now = Date.now();
      if (now - lastEmit.current >= THROTTLE_MS) {
        lastEmit.current = now;
        emitDrawing([...currentPoints.current], toolRef.current, colorRef.current, widthRef.current);
      }
    },
    [isHost, getPos, redrawPreview, emitDrawing],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!isHost || !isDrawing.current) return;
      isDrawing.current = false;

      let pts = [...currentPoints.current];
      currentPoints.current = [];

      if (pts.length === 1) pts = [pts[0], pts[0]];
      if (pts.length < 2) {
        redrawPreview();
        return;
      }

      const main = mainRef.current;
      if (main) {
        drawPath(main.getContext("2d"), pts, toolRef.current, colorRef.current, widthRef.current);
      }

      redrawPreview();
      emitStroke({ points: pts, tool: toolRef.current, color: colorRef.current, width: widthRef.current });
    },
    [isHost, redrawPreview, emitStroke],
  );

  // submit handler for AI prompt bar
  const handleAiSubmit = (e) => {
     e.preventDefault();
    const trimmed = aiPrompt.trim();
    if (!trimmed || aiGenerating) return;
    emitAIPrompt(trimmed);
    setAiPrompt("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/60 px-4 py-2">
        {isHost ? (
        <>
        <div className="flex gap-1">
          {[{ id: "pen", label: "✏️ Pen" }, { id: "eraser", label: "🧹 Eraser" }].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                tool === id
                  ? "bg-amber-600 text-white shadow-sm"
                  : "border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tool === "pen" && (
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${
                  color === c
                    ? "border-amber-600 ring-2 ring-amber-400 ring-offset-1"
                    : "border-gray-300"
                }`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 p-0 opacity-80 hover:opacity-100"
              title="Custom color"
            />
          </div>
        )}

        <div className="flex gap-1">
          {WIDTHS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setLineWidth(value)}
              className={`h-7 w-8 rounded text-xs font-semibold transition ${
                lineWidth === value
                ? "bg-amber-600 text-white"
                  : "border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={emitUndo}
            title="Undo your last stroke"
            className="rounded border border-amber-300 bg-white px-3 py-1 text-sm text-amber-800 transition hover:bg-amber-100"
          >
            ↩ Undo
          </button>
          <button
            onClick={emitClear}
            title="Clear the entire board"
            className="rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-700 transition hover:bg-red-50"
          >
            🗑 Clear All
          </button>
        </div>
        </>
        ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            👁 View only - only the host can draw
            </span>
        )}
        </div>

        {/* AI prompt bar, host only */}
      {isHost && (
        <form onSubmit={handleAiSubmit} className="flex items-center gap-2 border-b border-amber-200 bg-white px-4 py-2">
          <span className="text-sm shrink-0">🤖</span>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Describe a diagram, e.g. 'draw a 3-step login flow'"
            disabled={aiGenerating}
            className="flex-1 rounded border border-amber-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={aiGenerating || !aiPrompt.trim()}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiGenerating ? "Generating…" : "Generate"}
          </button>
        </form>
      )}


      <div className="relative flex-1 overflow-hidden bg-white">
        <canvas
          ref={mainRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 h-full w-full"
        />
        <canvas
          ref={previewRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 h-full w-full"
          style={{
            touchAction: "none",
            pointerEvents: isHost ? "auto" : "none",
            cursor: isHost ? (tool === "eraser" ? "cell" : "crosshair") : "default",
          }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>
    </div>
  );
};

export default WhiteboardPanel;