import * as tf from "@tensorflow/tfjs";
import * as toxicity from "@tensorflow-models/toxicity";

const THRESHOLD = 0.85; // confidence cutoff, can be tuned (if too strict or too loose)

let model = null;
let loadingPromise = null;

/**
  Loads the model once per browser session and keeps it in memory.
  Call this early (e.g. when the chat mounts) so the first message a
  person sends isn't the one that pays the load cost.
 */
export const loadModerationModel = async () => {
  if (model) return model;
  if (!loadingPromise) {
    loadingPromise = toxicity.load(THRESHOLD, []);
  }
  model = await loadingPromise;
  return model;
};

/**
   Returns { flagged: boolean, labels: string[] }.
 */
export const checkMessage = async (text) => {
  if (!text?.trim()) return { flagged: false, labels: [] };
  if (!model) await loadModerationModel();

  const predictions = await model.classify([text]);
  const labels = predictions
    .filter((p) => p.results[0].match === true)
    .map((p) => p.label);

  return { flagged: labels.length > 0, labels };
};
