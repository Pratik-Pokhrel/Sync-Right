import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";
import { hashToken } from "../utils/hashToken.js";
import { ENV } from "../config/env.js";
import jwt from "jsonwebtoken";

// cookie options for the refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
  sameSite: "Strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// Register Function
export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email }, { username: username }],
    });

    if (existingUser) {
      const errors = {}; // Prepare an errors object to provide specific feedback on which field(s) caused the conflict

      // Inspect which field(s) actually matched : field-level precision, zero extra queries
      if (existingUser.email === email.toLowerCase())
        errors.email = "Email already in use";
      if (existingUser.username === username)
        errors.username = "Username already taken";

      return res.status(409).json({
        success: false,
        message: "Registration failed",
        errors, // Provide specific feedback on which field(s) caused the conflict to the frontend for better user experience
      });
    }

    const newUser = await User.create({ username, email, password });

    // Never issue tokens immediately upon registration, require users to log in first
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser.toSafeObject(), // Send sanitized user object without sensitive fields
    });
  } catch (error) {
    next(error);
  }
};
