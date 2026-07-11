import { ENV } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  //Mongoose Validation Error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Mongoose validation Error : ",
      errors,
    });
  }

  //Mongoose Duplicate Key Error (eg: duplicate email or username)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Mongoose duplicate key error: ${field} already in use`,
    });
  }

  // JWT Error (eg: invalid or expired token)
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Token expired" });
  }

  // Multer error ( file too large / wrong field name )
  if (err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 10 MB or smaller"
        : err.message;
    return res.status(400).json({ success: false, message });
  }

  // check file-type rejection thrown from upload.js middleware
  if (err.message === "Only JPEG, PNG, JPG or WEBP images are allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }

  //Fallback for any other unhandled errors
  const statusCode = err.statusCode || 500;
  const message =
    ENV.NODE_ENV === "production" ? "An error occurred" : err.message;

  return res.status(statusCode).json({ success: false, message });
};
