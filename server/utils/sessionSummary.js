import { askGroq } from "./aiClient.js";

const SYSTEM_PROMPT = `You are a meeting summarizer. Given a chat transcript, respond ONLY with valid JSON in this exact shape, no markdown fences, no preamble:
{
  "summary": "3-4 sentence summary of what was discussed",
  "actionItems": ["short action item 1", "short action item 2"]
}
If there are no clear action items, return an empty array for actionItems.`;

/*
    Takes a plain transcript string (already decrypted at the client's side) and asks
    the Groq to summarize it.
    Never throws, falls back to a safe default
*/

export const generateSessionSummaryFromTranscript = async (transcript) => {
  if (!transcript?.trim()) {
    return { summary: "No messages were exchanged" };
  }

  try {
    const raw = await askGroq(SYSTEM_PROMPT, transcript, true);
    const parsed = JSON.parse(raw);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch (err) {
    console.error("[sessionSummary] generation failed!", err.message);
    return { summary: "Summary generation failed!", actionItems: [] };
  }
};
