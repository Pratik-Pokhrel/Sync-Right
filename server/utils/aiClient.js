import Groq from "groq-sdk";
import { ENV } from "../config/env.js";

const groq = new Groq({ apiKey: ENV.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile"; // llm model to use

export const askGroq = async (systemPrompt, userPrompt, jsonMode = false) => {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    message: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    response_format: jsonMode ? { type: "json_object" } : undefined,
  });

  return completion.choices[0].message?.content || "";
};
