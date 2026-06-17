import express from "express";
import { getIceConfig } from "../controllers/callController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET/call/ice-config (protected)
router.get("/ice-config", protect, getIceConfig);

export default router;
