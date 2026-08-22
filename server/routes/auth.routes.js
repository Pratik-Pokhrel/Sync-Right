import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  uploadProfilePicture,
  removeProfilePicture,
  setup2FA,
  verifySetup2FA,
  verify2FA,
  disable2FA,
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

// 2FA routes
router.post("/2fa/setup", protect, setup2FA); // start enrollment
router.post("/2fa/verify-setup", protect, verifySetup2FA); // confirm enrollment with first otp
router.post("/2fa/verify", verify2FA);
router.post("/2fa/disable", protect, disable2FA);

// cloudinary
router.patch(
  "/avatar",
  protect,
  uploadAvatar.single("avatar"),
  uploadProfilePicture,
);
router.delete("/avatar", protect, removeProfilePicture);

export default router;
