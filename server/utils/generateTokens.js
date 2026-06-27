import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

// Payload : only non-sensitive info, like user ID and role
export const generateAccessToken = (user) => {
  return jwt.sign(
    // Sign the payload with the secret key
    { id: user._id, role: user.role },
    ENV.JWT_ACCESS_SECRET,
    { expiresIn: ENV.JWT_ACCESS_EXPIRY },
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    // Sign the payload with the secret key
    { id: user._id },
    ENV.JWT_REFRESH_SECRET,
    { expiresIn: ENV.JWT_REFRESH_EXPIRY },
  );
};

// what this file does is, it generate access and refresh tokens for a user. The access token contains the user's ID and role, and is signed with a secret key. The refresh token only contains the user's ID, and is also signed with a different secret key. Both tokens have an expiration time defined in the environment variables.
