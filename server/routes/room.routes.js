import express from "express";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  deleteRoom,
  listRooms,
  listMyRooms,
  getRoomById,
} from "../controllers/roomController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  validateCreateRoom,
  validateJoinRoom,
} from "../middleware/validate.js";

const router = express.Router();

// All of the room related routes are protected i.e. the user must be authenticated
router.use(protect);

router.get("/", listRooms);
router.post("/create", validateCreateRoom, createRoom);
router.get("/mine", listMyRooms);
router.get("/:roomId", getRoomById);
router.post("/join/:roomId", validateJoinRoom, joinRoom);
router.post("/leave/:roomId", leaveRoom);
router.delete("/:roomId", deleteRoom);

export default router;
