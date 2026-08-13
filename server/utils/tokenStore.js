import { redis } from "../config/redis.js";
import { hashToken } from "./hashToken.js";

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days(in seconds)

// store the hashed refresh token in Redis with a TTL -> to replace the "user.refreshToken" in authcontroller.js
// no mongodb write, no cleanup needed since the key now expires on its own

export const storeRefreshToken = async (userId, rawToken) => {
  const hash = hashToken(rawToken);
  await redis.set(`refreshToken:${userId}`, hash, "EX", REFRESH_TTL);
};

// now verify the refresh token by comparing the hash stored in Redis with the hash of the provided token
export const verifyRefreshToken = async (userId, rawToken) => {
  const stored = await redis.get(`refreshToken:${userId}`);
  if (!stored) return false; // no token stored, either expired or never set
  return stored === hashToken(rawToken); // compare the stored hash with the hash of the provided token
};

// revoke the token on logout
export const revokeRefreshToken = async (userId) => {
  await redis.del(`refreshToken:${userId}`);
};
