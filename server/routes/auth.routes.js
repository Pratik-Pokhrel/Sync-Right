import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, getMe); // Protected route to get the logged-in user's profile info

export default router;
