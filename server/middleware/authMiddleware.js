import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/User.js";

// Middleware to protect routes and ensure the user is authenticated
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No access token provided",
      });
    }

    const token = authHeader.split(" ")[1]; // Extract just the token from the "Bearer <token>" format

    let payload;
    try {
      payload = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or expired access token",
      });
    }

    // E2E - MFA gate
    /* A token issued mid-login for a 2FA-enabled
      account carries mfaPending: true and must not unlock protected
      routes until the OTP step succeeds
    */
    if (payload.mfaPending) {
      return res.status(401).json({
        success: false,
        message: "MFA verification required",
        mfaPending: true,
      });
    }

    // Attach user info to the request object for use in subsequent middleware or route handlers
    const user = await User.findById(payload.id);
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }

    req.user = user; // Attach the full user document to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    next(error);
  }
};
