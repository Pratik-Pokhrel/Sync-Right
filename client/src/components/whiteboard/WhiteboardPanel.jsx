import { useEffect, useRef, useCallback, useState } from "react";
import {
  CANVAS_W,
  CANVAS_H,
  SHAPE_TOOLS,
  drawStroke,
  boundsFromPoints,
  ensureMinSize,
} from "../../utils/whiteboardDraw";

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

const DRAW_TOOLS = [
  { id: "pen", label: "✏️ Pen" },
  { id: "eraser", label: "🧹 Eraser" },
];

const SHAPE_BUTTONS = [
  { id: "rect", label: "▭ Rect" },
  { id: "ellipse", label: "◯ Oval" },
  { id: "triangle", label: "△ Triangle" },
  { id: "line", label: "／ Line" },
];

const isShapeTool = (t) => SHAPE_TOOLS.includes(t);

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
  const textInputRef = useRef(null);

  const isDrawing = useRef(false);
  const startPos = useRef(null);
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
  const [textDraft, setTextDraft] = useState(null);
  const textDraftRef = useRef(null);

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
    strokes.forEach((stroke) => drawStroke(ctx, stroke));
  }, [strokes]);

  const redrawPreview = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    Object.values(activeStrokesRef.current).forEach((stroke) =>
      drawStroke(ctx, stroke, { preview: stroke.tool === "text" }),
    );

    if (isDrawing.current && currentPoints.current.length >= 2) {
      drawStroke(
        ctx,
        {
          points: currentPoints.current,
          tool: toolRef.current,
          color: colorRef.current,
          width: widthRef.current,
        },
        { preview: toolRef.current === "text" },
      );
    }
  }, []);

  useEffect(() => {
    activeStrokesRef.current = activeStrokes;
    redrawPreview();
  }, [activeStrokes, redrawPreview]);

  useEffect(() => {
    if (!isHost) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        emitUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isHost, emitUndo]);

  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  const getPos = useCallback((e) => {
    const rect = previewRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: Math.min(1, Math.max(0, (src.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (src.clientY - rect.top) / rect.height)),
    };
  }, []);

  const commitTextDraft = useCallback(() => {
    const draft = textDraftRef.current;
    if (!draft) return;
    textDraftRef.current = null;
    setTextDraft(null);

    const value = draft.value?.trim();
    if (value) {
      const pts = [
        { x: draft.x, y: draft.y },
        { x: draft.x + draft.w, y: draft.y + draft.h },
      ];
      const stroke = {
        points: pts,
        tool: "text",
        color: colorRef.current,
        width: widthRef.current,
        text: draft.value,
      };
      const main = mainRef.current;
      if (main) drawStroke(main.getContext("2d"), stroke);
      emitStroke(stroke);
    }
    redrawPreview();
  }, [emitStroke, redrawPreview]);

  const onPointerDown = useCallback(
    (e) => {
      if (!isHost || textDraft) return;
      e.preventDefault();
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const pos = getPos(e);
      isDrawing.current = true;
      startPos.current = pos;
      currentPoints.current = [pos, pos];
      redrawPreview();
    },
    [isHost, textDraft, getPos, redrawPreview],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isHost || textDraft) return;
      if (!isDrawing.current) return;
      e.preventDefault();

      const pos = getPos(e);
      const t = toolRef.current;
      if (t === "pen" || t === "eraser") {
        currentPoints.current.push(pos);
      } else {
        currentPoints.current = [startPos.current, pos];
      }
      redrawPreview();

      const now = Date.now();
      if (t !== "text" && now - lastEmit.current >= THROTTLE_MS) {
        lastEmit.current = now;
        emitDrawing([...currentPoints.current], t, colorRef.current, widthRef.current);
      }
    },
    [isHost, textDraft, getPos, redrawPreview, emitDrawing],
  );

  const onPointerUp = useCallback(
    () => {
      if (!isHost || !isDrawing.current) return;
      isDrawing.current = false;

      let pts = [...currentPoints.current];
      currentPoints.current = [];
      const t = toolRef.current;

      if (pts.length === 1) pts = [pts[0], pts[0]];
      if (pts.length < 2) {
        redrawPreview();
        return;
      }

      if (t === "text") {
        const [a, b] = ensureMinSize(pts[0], pts[pts.length - 1], t);
        const draft = { ...boundsFromPoints(a, b), value: "" };
        textDraftRef.current = draft;
        redrawPreview();
        setTextDraft(draft);
        return;
      }

      if (isShapeTool(t)) {
        pts = ensureMinSize(pts[0], pts[pts.length - 1], t);
      }

      const stroke = {
        points: pts,
        tool: t,
        color: colorRef.current,
        width: widthRef.current,
      };

      const main = mainRef.current;
      if (main) drawStroke(main.getContext("2d"), stroke);

      redrawPreview();
      emitStroke(stroke);
    },
    [isHost, redrawPreview, emitStroke],
  );

  const handleAiSubmit = (e) => {
    e.preventDefault();
    const trimmed = aiPrompt.trim();
    if (!trimmed || aiGenerating) return;
    emitAIPrompt(trimmed);
    setAiPrompt("");
  };

  const cursor =
    !isHost
      ? "default"
      : tool === "eraser"
        ? "cell"
        : tool === "text"
          ? "text"
          : "crosshair";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/60 px-4 py-2">
        {isHost ? (
          <>
            <div className="flex gap-1">
              {DRAW_TOOLS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (textDraftRef.current) commitTextDraft();
                    setTool(id);
                  }}
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

            <div className="h-6 w-px bg-amber-200" />

            <div className="flex gap-1">
              {SHAPE_BUTTONS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (textDraftRef.current) commitTextDraft();
                    setTool(id);
                  }}
                  className={`rounded px-2.5 py-1 text-sm font-medium transition ${
                    tool === id
                      ? "bg-amber-600 text-white shadow-sm"
                      : "border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  if (textDraftRef.current) commitTextDraft();
                  setTool("text");
                }}
                className={`rounded px-2.5 py-1 text-sm font-medium transition ${
                  tool === "text"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                }`}
              >
                T Text
              </button>
            </div>

            {tool !== "eraser" && (
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

            {tool !== "text" && (
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
            )}

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

      {isHost && (
        <form
          onSubmit={handleAiSubmit}
          className="flex items-center gap-2 border-b border-amber-200 bg-white px-4 py-2"
        >
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
            pointerEvents: isHost && !textDraft ? "auto" : "none",
            cursor,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {textDraft && (
          <textarea
            ref={textInputRef}
            value={textDraft.value}
            onChange={(e) => {
              const next = { ...textDraft, value: e.target.value };
              textDraftRef.current = next;
              setTextDraft(next);
            }}
            onBlur={() => commitTextDraft()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                textDraftRef.current = null;
                setTextDraft(null);
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextDraft();
              }
            }}
            placeholder="Type here…"
            className="absolute z-10 resize-none rounded border-2 border-amber-500 bg-white/95 px-1 py-0.5 text-sm text-gray-900 shadow-sm outline-none"
            style={{
              left: `${textDraft.x * 100}%`,
              top: `${textDraft.y * 100}%`,
              width: `${Math.max(textDraft.w * 100, 8)}%`,
              height: `${Math.max(textDraft.h * 100, 6)}%`,
              color,
              fontFamily: "sans-serif",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WhiteboardPanel;
