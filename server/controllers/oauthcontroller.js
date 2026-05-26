import { OAuth2Client } from "google-auth-library";
import { ENV } from "../config/env.js";
import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateTokens.js";
import { hashToken } from "../utils/hashToken.js";

const googleClient = new OAuth2Client(
  ENV.GOOGLE_CLIENT_ID,
  ENV.GOOGLE_CLIENT_SECRET,
  ENV.GOOGLE_REDIRECT_URI,
);

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
  sameSite: "Strict", // sameSite: "Strict" means the cookie will only be sent in a first-party context and not with requests initiated by third party websites, providing better protection against CSRF attacks.
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};
