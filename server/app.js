import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";

import { ENV } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Security and parsing middleware - keep this at the top before defining routes to ensure all requests are processed through these middlewares first
app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173", // The frontend's URL
    credentials: true, // Allow cookies to be sent in cross-origin requests
  }),
);

app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies (eg: form submissions)
app.use(cookieParser()); // Parse cookies from incoming requests and attach them to req.cookies, required for handling refresh tokens stored in cookies
app.use(morgan("dev")); // Log HTTP requests in development mode

// All the routes
app.use("/", authRoutes);

// Health check route - useful for monitoring and testing if the server is running
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

app.use(errorHandler); // Global error handling middleware, should be registered after all routes

export default app;
