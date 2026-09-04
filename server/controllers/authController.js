import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";
// hashToken import removed -> no longer hashing/comparing refresh tokens here directly
// that logic now lives inside tokenStore.js ( redis implementation )
import {
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from "../utils/tokenStore.js";
import { ENV } from "../config/env.js";
import jwt from "jsonwebtoken";
import cloudinary from "../config/cloudinary.js";
import { redis } from "../config/redis.js";

// E2E imports
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { audit } from "../utils/audit.js";

// cookie options for the refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Required over HTTPS in production
  sameSite: ENV.NODE_ENV === "production" ? "none" : "lax", // "none" allows cross-origin cookies between frontend and backend
  maxAge: 3 * 24 * 60 * 60 * 1000,
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
      // audit failed attempt -> because here's no actor that means no valid user
      audit("user.login_fail", { meta: { email }, req });
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      audit("user.login_fail", { meta: { email }, req });
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" }); //
    }

    // MFA gate -> if the account has 2FA enabled, stop here and issue a short lived restriction token instead of the real access
    if (user.twoFactorEnabled) {
      const mfaToken = jwt.sign(
        { id: user._id, mfaPending: true },
        ENV.JWT_ACCESS_SECRET,
        { expiresIn: "5m" },
      );

      return res.status(200).json({
        success: true,
        mfaPending: true,
        mfaToken,
        message: "OTP required",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // No more user.refreshToken field write after Redis implementation, no user.save() needed here.
    await storeRefreshToken(user._id.toString(), refreshToken);

    // Refresh token is sent as an HTTP-only cookie, while the access token is sent in the response body
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    // audit successful login attempt
    audit("user.login", { actor: user._id, req });

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

    // check the hashed token matches what's in DB (revocation check) -> revocation check now goes through Redis instead of a User.select("+refreshToken")query
    const isValid = await verifyRefreshToken(payload.id, token);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Refresh token revoked or reuse detected",
      });
    }

    /* still needs the user doc, but no longer need +refreshToken selected
      since Redis is now the source of truth for the token itself. Only used
      here for role (goes into the new access token payload).
    */
    const user = await User.findById(payload.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    // Generate new access and refresh tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Updating the stored hashed refresh token in the database -> replaced with a Redis overwrite (storeRefreshToken sets a fresh TTL too,
    // so rotation resets the 3-day window instead of counting down from original login)
    await storeRefreshToken(user._id.toString(), newRefreshToken);

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
        //Clear the stored hashed refresh token in the database to effectively log the user out -> replaced User.findByIdAndUpdate(... refreshToken: null) with a direct Redis key delete. Same effect (revoked immediately), no DB write.
        await revokeRefreshToken(payload.id);

        // audit successful logout attempt
        audit("user.logout", { actor: payload.id, req });
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

// ---------------------2FA Controllers ---------------//

/* POST /auth/2fa/setup (protected) -> generates a secret + QR code and then
  stores the secret in Redis temporarily until the user confirms with the real otp
*/
export const setup2FA = async (req, res, next) => {
  try {
    const secret = authenticator.generateSecret(); // base32 string
    const otpauth = authenticator.keyuri(req.user.email, "SyncRight", secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    // 10 min - TTL -> unconfirmed secrets never touch the User document
    await redis.set(`2fa:setup:${req.user._id}`, secret, "EX", 600);

    return res.status(200).json({ success: true, qrCode, otpauth });
  } catch (error) {
    next(error);
  }
};

/*
  POST /auth/2fa/verify-setup (protected) -> confirms enrollment with the
  first real OTP from the authenticator app, only then persists the secret
*/
export const verifySetup2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "2FA token is required",
      });
    }

    const secret = await redis.get(`2fa:setup:${req.user._id}`);

    if (!secret) {
      return res.status(400).json({
        success: false,
        message: "2FA setup expired, please restart the setup",
      });
    }

    const valid = authenticator.check(token, secret);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid 2FA token",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    });
    await redis.del(`2fa:setup:${req.user._id}`); // remove the secret from Redis

    audit("user.2fa_enable", { actor: req.user._id, req });

    return res
      .status(200)
      .json({ success: true, message: "2FA enabled : Setup success" });
  } catch (error) {
    next(error);
  }
};

/*
  POST /auth/2fa/verify (public route, gated by the short-lived mfaToken
  issued from login()) -> submits the OTP and, on success, issues real tokens
*/
export const verify2FA = async (req, res, next) => {
  try {
    const { mfaToken, otp } = req.body;

    if (!mfaToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "mfaToken and otp are required",
      });
    }

    let payload;
    try {
      payload = jwt.verify(mfaToken, ENV.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired MFA session, login again",
      });
    }

    if (!payload.mfaPending) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid MFA token" });
    }

    const user = await User.findById(payload.id).select("+twoFactorSecret");

    if (!user || !user.isActive || !user.twoFactorEnabled) {
      return res
        .status(401)
        .json({ success: false, message: "User not found or inactive" });
    }

    const valid = authenticator.check(otp, user.twoFactorSecret);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Now OTP is confirmed -> now real token pair is issued, same as normal login
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await storeRefreshToken(user._id.toString(), refreshToken);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS); // Set the refresh token cookie on the client side

    audit("user.login", { actor: user._id, meta: { via: "2FA" }, req });

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    next(err);
  }
};

/*
  POST /auth/2fa/disable (protected) -> requires a valid current OTP as
  confirmation before turning 2FA off, so a stolen access token alone
  can't disable someone's second factor
*/
export const disable2FA = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id).select("+twoFactorSecret");

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled",
      });
    }

    const valid = authenticator.check(otp, user.twoFactorSecret);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.twoFactorSecret = null;
    user.twoFactorEnabled = false;
    await user.save();

    audit("user.2fa_disabled", { actor: user._id, req });

    return res.status(200).json({
      success: true,
      message: "2FA disabled",
    });
  } catch (error) {
    next(error);
  }
};
