import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleAuthorize } from "../middleware/roleAuthorize.js";
import {
  getAllUsers,
  getUserById,
  setUserStatus,
  deleteUser,
} from "../controllers/adminController.js";

const router = express.Router();

// Every admin router requires: valid access token (protect) + admin role (roleAuthorize)
router.use(protect, roleAuthorize("admin"));

// User management routes
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/status", setUserStatus);
router.delete("/users/:id", deleteUser);

export default router;
