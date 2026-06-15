import express from "express";
import { getRoomMessages } from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// GET /messages/:roomId?page=1&limit=50
router.get("/:roomId", getRoomMessages);

export default router;
