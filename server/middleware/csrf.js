import { doubleCsrf } from "csrf-csrf";
import { ENV } from "../config/env.js";

// csrf-csrf implements the Double Submit Cookie pattern: it sets a cookie
// containing an HMAC'd token, and expects the same token echoed back in a
// request header (x-csrf-token) on state-changing requests. Stateless,
// no server-side session needed, works fine alongside our Bearer-token API.
const { invalidCsrfTokenError, generateCsrfToken, doubleCsrfProtection } =
  doubleCsrf({
    getSecret: () => ENV.JWT_ACCESS_SECRET, // any stable server secret works here
    getSessionIdentifier: (req) => req.ip, // no sessions in this app, IP is enough entropy for the double-submit pattern
    cookieName: "csrf-token",
    cookieOptions: {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: "strict",
    },
    getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"],
  });

// Applied to routes that need CSRF protection (e.g. /auth/google)
export const csrfProtection = doubleCsrfProtection;

// Sends the CSRF token to the client — call this once before initiating
// a protected flow (client stores it, sends it back in the x-csrf-token header)
export const sendCsrfToken = (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
};

// Must be registered AFTER routes and BEFORE the global errorHandler
export const csrfErrorHandler = (err, req, res, next) => {
  if (err !== invalidCsrfTokenError) return next(err);
  return res.status(403).json({
    success: false,
    message: "CSRF token validation failed. Refresh and retry.",
  });
};
