import { OAuth2Client } from "google-auth-library";
import { randomBytes, timingSafeEqual } from "crypto";
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

// const ACCESS_COOKIE_OPTIONS = {
//   httpOnly: true,
//   secure: ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
//   sameSite: "Strict",
//   maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
// };

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
  sameSite: "Strict", // sameSite: "Strict" means the cookie will only be sent in a first-party context and not with requests initiated by third party websites, providing better protection against CSRF attacks.
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 10 * 60 * 1000,
  path: "/auth",
};

// 1st Step :: Redirect user to Google's consent screen
export const googleRedirect = (req, res) => {
  const state = randomBytes(32).toString("hex");
  res.cookie("oauthState", state, OAUTH_STATE_COOKIE_OPTIONS);

  const url = googleClient.generateAuthUrl({
    access_type: "offline", // Request a refresh token for long-term access from google
    scope: ["profile", "email"], // Request access to user's profile and email
    prompt: "consent", // Prompt the user to grant consent to access their profile and email
    state,
  });
  res.redirect(url);
};

//2nd step :: Handle the callback after the Google redirects back to your app
export const googleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.oauthState;
    res.clearCookie("oauthState", OAUTH_STATE_COOKIE_OPTIONS);

    if (
      !state ||
      !savedState ||
      state.length !== savedState.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(savedState))
    ) {
      return res.redirect(`${ENV.CLIENT_URL}/login?error=oauth_state_invalid`);
    }

    if (!code) {
      return res.redirect(`${ENV.CLIENT_URL}/login?error=oauth_failed`);
    }

    // Exchange the auth code for google tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Verify the ID token and extract the user info
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: ENV.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, email, name, picture } = ticket.getPayload();

    //Find either the existing user or create a new one
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      // Create a new user but with Google info, no password required
      user = await User.create({
        username: name,
        email,
        googleId,
        avatar: picture,
        authProvider: "google",
        // No password required for Google OAuth because our schema allows this for the google Provider
      });
    } else if (!user.googleId) {
      // In case of an Existing local account, link it with Google
      user.googleId = googleId;
      user.avatar = picture;
      user.authProvider = "google"; // or keep "local" if you want to track merged accounts
      await user.save();
    }

    // Issue its own JWT pair , same as login
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    // Redirect to frontend with accessToken in query param
    // Frontend grabs it from URL, stores in memory, then clears the URL
    res.redirect(`${ENV.CLIENT_URL}/oauth/callback?token=${accessToken}`);

    // res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTIONS);
    // res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    // res.redirect(`${ENV.CLIENT_URL}/oauth/callback`);
    // clean URL, no token
  } catch (error) {
    next(error);
  }
};
