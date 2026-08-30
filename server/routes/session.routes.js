//session summary + report routes

import express from "express";
import {
  getSessionById,
  getActiveSessionForRoom,
  submitSessionSummary,
  getSessionReport,
} from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/room/:roomId/active", getActiveSessionForRoom);
router.get("/:id", getSessionById);
router.post("/:id/summarize", submitSessionSummary);
router.get("/:id/report", getSessionReport);

export default router;
