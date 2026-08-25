import express from "express";
import {
  googleRedirect,
  googleCallback,
} from "../controllers/oauthController.js";
import { csrfProtection, sendCsrfToken } from "../middleware/csrf.js";

const router = express.Router();

// client fetches this before initiating OAuth
router.get("/csrf-token", csrfProtection, sendCsrfToken);

router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

export default router;
