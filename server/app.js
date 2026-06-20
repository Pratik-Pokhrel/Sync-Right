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

const app = express();

// Security and parsing middleware - keep this at the top before defining routes to ensure all requests are processed through these middlewares first
app.use(helmet());

app.use(
  cors({
    origin: ENV.CLIENT_URL || "http://localhost:5173", // The frontend's URL
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
app.use("/auth", authRoutes); // auth-related routes like /register, /login and so on
app.use("/auth", oauthRoutes); // new -> /auth/google, /auth/google/callback
app.use("/admin", adminRoutes); // admin-related routes like /admin/users, /admin/users/:id/role and so on
app.use("/rooms", roomRoutes); // room related routes
app.use("/messages", messageRoutes); // message related routes
app.use("/call", callRoutes);

// Health check route - useful for monitoring and testing if the server is running
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

app.use(errorHandler); // Global error handling middleware, should be registered after all routes

export default app;
