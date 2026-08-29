import { askGroq } from "./aiClient.js";

const SYSTEM_PROMPT = `You convert a user's request into whiteboard drawing strokes for a simple diagram tool.
Respond ONLY with valid JSON, no markdown, in this exact shape:
{
  "strokes": [
    { "points": [{"x":0.1,"y":0.1},{"x":0.3,"y":0.1}], "tool": "pen", "color": "#1a1a1a", "width": 3 }
  ]
}
Rules:
- Coordinates are normalized 0 to 1 (0,0 is top-left, 1,1 is bottom-right).
- Each stroke needs at least 2 points.
- Build boxes, arrows, and simple lines using straight-line segments. Approximate labels with short simple strokes, keep any text minimal and blocky.
- Keep it under 40 strokes total.
- tool is always "pen". color is a hex string. width is between 2 and 6.
- Only return the JSON object, nothing else, no explanation.`;

const isValidPoint = (p) =>
  p &&
  typeof p.x === "number" &&
  typeof p.y === "number" &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1;

const isValidStroke = (s) =>
  s &&
  Array.isArray(s.points) &&
  s.points.length >= 2 &&
  s.points.every(isValidPoint);

export const generateStrokesFromPrompt = async (prompt) => {
  try {
    const raw = await askGroq(SYSTEM_PROMPT, prompt, true);
    const parsed = JSON.parse(raw);
    const strokes = Array.isArray(parsed.strokes) ? parsed.strokes : [];

    return strokes
      .filter(isValidStroke)
      .slice(0, 40)
      .map((s) => ({
        points: s.points,
        tool: "pen",
        color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#1a1a1a",
        width: Number.isFinite(s.width) ? Math.min(Math.max(s.width, 2), 6) : 3,
      }));
  } catch (err) {
    console.error("[whiteboardAI] generation failed:", err.message);
    return [];
  }
};
