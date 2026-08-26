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
  );
};

// The access token expires through JWT. Refresh-token lifetime is controlled by Redis TTL.
