import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  uploadProfilePicture,
  removeProfilePicture,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateRegister, validateLogin } from "../middleware/validate.js";
import { uploadAvatar } from "../middleware/upload.js";

const router = express.Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, getMe); // Protected route to get the logged-in user's profile info

router.patch(
  "/avatar",
  protect,
  uploadAvatar.single("avatar"),
  uploadProfilePicture,
);
router.delete("/avatar", protect, removeProfilePicture);

export default router;
