import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";

import { ENV } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import roomRoutes from "./routes/room.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import messageRoutes from "./routes/message.routes.js";
import callRoutes from "./routes/call.routes.js";
import sessionRoutes from "./routes/session.routes.js";

import { csrfErrorHandler } from "./middleware/csrf.js";
import { authLimiter, apiLimiter } from "./config/rateLimiter.js";

const app = express();

// Security and parsing middleware - kept at the top before defining routes to ensure all requests are processed through these middlewares first
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // no inline JS, no eval
        styleSrc: ["'self'", "'unsafe-inline'"], // inline styles OK (tailwind)
        imgSrc: [
          "'self'",
          "data:",
          "https://lh3.googleusercontent.com",
          "https://api.dicebear.com",
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:8000",
          "http://localhost:8000",
          "ws://192.168.1.74:8000",
          "ws://192.168.1.92:8000",
          "http://192.168.64.1:8000",
          "ws://192.168.64.1:8000",
        ], // deployed origins - adjusted for local development
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"], // prevents clickjacking
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // needed for WebRTC peer connections
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

// for production level security
// if (ENV.NODE_ENV === "production") {
//   app.use(
//     helmet.hsts({
//       maxAge: 31536000,
//       includeSubDomains: true,
//       preload: true,
//     }),
//   );
// }

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.1.74:5173",
      "http://192.168.1.92:5173",
      "http://192.168.56.1:5173",
      "http://127.0.0.1:5173",
      "http://192.168.64.1:5173",
      ENV.CLIENT_URL,
    ], // The frontend's URL
    credentials: true, // Allow cookies to be sent in cross-origin requests
  }),
);

app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies (eg: form submissions)
app.use(cookieParser()); // Parse cookies from incoming requests and attach them to req.cookies, required for handling refresh tokens stored in cookies
app.use(morgan("dev")); // Log HTTP requests in development mode

// In production, enclose the morgan logger in a condition to avoid logging sensitive information and to improve performance
// if (ENV.NODE_ENV === "production") {
//   app.use(morgan("combined")); // Use a more concise logging format in production
// }

// --------------- All the routes go here ---------///
app.use("/auth", authLimiter, authRoutes); // auth-related routes like /register, /login and so on
app.use("/auth", authLimiter, oauthRoutes); // new -> /auth/google, /auth/google/callback
app.use("/admin", apiLimiter, adminRoutes); // admin-related routes like /admin/users, /admin/users/:id/role and so on
app.use("/rooms", apiLimiter, roomRoutes); // room related routes
app.use("/messages", apiLimiter, messageRoutes); // message related routes
app.use("/call", apiLimiter, callRoutes); // call related routes
app.use("/sessions", apiLimiter, sessionRoutes); // session related routes

// Health check route - useful for monitoring and testing if the server is running
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

app.use(csrfErrorHandler);
app.use(errorHandler); // Global error handling middleware, should be registered after all routes

export default app;
