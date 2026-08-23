import csrf from "csrf-csrf";
import { ENV } from "../config/env.js";

// cookie based csrf -> works without server side sessions
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production", // only send cookie over HTTPS in production
    sameSite: "Strict", // sameSite: "Strict" means the cookie will only be sent in a first-party context and not with requests initiated by third party websites
  },
});

// sends the csrf token to the client so it can be attached to the next state changing request (like before hitting /auth/google)
export const sendCsrfToken = (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
};

// Must be registered AFTER routes and BEFORE the global errorHandler
export const csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== "EBADCSRFTOKEN") return next(err);
  return res.status(403).json({
    success: false,
    message: "Invalid CSRF token, refresh and try again",
  });
};
