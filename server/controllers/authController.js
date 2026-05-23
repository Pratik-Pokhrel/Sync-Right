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

// Login Function
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    ); // Explicitly select the password field for authentication
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" }); //
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store only the hashed refresh token in the database for security reasons
    user.refreshToken = hashToken(refreshToken);
    await user.save();

    // Refresh token is sent as an HTTP-only cookie, while the access token is sent in the response body
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: user.toSafeObject(), // Send sanitized user object without sensitive fields
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token Function
export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken; // Get the refresh token from the HTTP-only cookie
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }

    // Verify the refresh token's signature and extract the payload
    let payload;
    try {
      payload = jwt.verify(token, ENV.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Check the hashed token matches what's in DB (revocation check)
    const user = await User.findById(payload.id).select("+refreshToken");
    if (!user || user.refreshToken !== hashToken(token)) {
      return res.status(401).json({
        success: false,
        message: "Refresh token revoked or reuse detected",
      });
    }

    // Generate new access and refresh tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = hashToken(newRefreshToken); // Update the stored hashed refresh token in the database
    await user.save();

    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS); // Send the new refresh token as an HTTP-only cookie

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
    });

    // End of refresh token flow
  } catch (error) {
    next(error);
  }
};

// Logout Function
export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken; // Get the refresh token from the HTTP-only cookie

    if (token) {
      // Nullify the stored token -> revokes refresh capability
      const payload = jwt.decode(token); // Decode the token to get the user ID without verifying the signature, since we just want to identify the user for logout
      if (payload?.id) {
        await User.findByIdAndUpdate(payload.id, { refreshToken: null }); // Clear the stored hashed refresh token in the database to effectively log the user out
      }
    }

    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS); // Clear the refresh token cookie on the client side
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get Me Function - to let the logged-in user get back their own profile info even if the page is refreshed
export const getMe = async (req, res) => {
  // req.user is populated by the auth middleware after verifying the access token
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};
