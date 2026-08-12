import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";
import { hashToken } from "../utils/hashToken.js";
import { ENV } from "../config/env.js";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinary.js";

// cookie options for the refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
  sameSite: "lax",
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

// upload / replace profile picture -> PATCH / auth/avatar (protected)
// req.file is populated by the "uploadAvatar" multer middleware (memory storage)
export const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // upload the in-memory file buffer to cloudinary as a data URI
    // overwrite : true -> reusing the same public_id replaces the old file
    // transformation : server-side resize/crop so we never store an oversized original; face aware crop for a clean circular look
    const uploadResult = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      {
        public_id: req.user._id.toString(),
        asset_folder: "sync-right/avatars", // folder -> asset_folder
        overwrite: true,
        resource_type: "image",
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
    );

    // here user.select("+avatarPublicId") is not needed -> because we're writing, not selecting the avatarPublicId
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        avatar: uploadResult.secure_url,
        avatarPublicId: uploadResult.public_id,
      },
      { new: true }, // return the updated user document
    );

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      avatar: user.avatar, // return the updated avatar
    });
  } catch (error) {
    next(error);
  }
};

// Remove Profile Picture -> DELETE /auth/avatar (protected)
// Reverts the user to the generated default avatar (frontend handles the fallback rendering when avatar is null, nothing default is stored in DB)
export const removeProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+avatarPublicId");

    if (user.avatarPublicId) {
      // Best-effort delete from Cloudinary, if this fails (e.g. already
      // deleted), don't block clearing the DB reference
      await cloudinary.uploader
        .destroy(user.avatarPublicId)
        .catch((err) =>
          console.error("[cloudinary] destroy failed:", err.message),
        );
    }

    user.avatar = null;
    user.avatarPublicId = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile picture removed",
    });
  } catch (error) {
    next(error);
  }
};
