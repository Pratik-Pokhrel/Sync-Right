import crypto from "crypto";

// SHA-256 hash of the refresh token before storing in DB
// So even if DB is compromised, raw tokens aren't exposed

export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// We don't store the ACCESS_TOKEN in the database, only the REFRESH_TOKEN (hashed) for security reasons. The access token is short-lived and can be easily revoked by not accepting it after its expiry time. The refresh token is long-lived and can be used to obtain new access tokens without requiring the user to log in again, but we store only its hash in the database to protect against token theft.
